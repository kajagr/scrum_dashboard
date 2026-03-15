import { NextRequest } from "next/server";
import { POST } from "@/app/api/stories/[storyId]/tasks/route";

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockGetUser = jest.fn();
const mockFrom = jest.fn<any, any>();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (...args: any[]) => mockFrom(...args),
    }),
  ),
}));

// ─── Helper funkcije ──────────────────────────────────────────────────────────
function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/stories/story-1/tasks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(storyId = "story-1") {
  return { params: Promise.resolve({ storyId }) };
}

// ─── Default podatki ──────────────────────────────────────────────────────────
const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  sprint_id: "sprint-1",
  status: "in_progress",
};

const activeSprint = {
  id: "sprint-1",
  start_date: yesterday,
  end_date: tomorrow,
};

const defaultMembership = { role: "developer" };

const validBody = {
  description: "Implementiraj login",
  estimated_hours: 4,
};

// ─── Setup mock ───────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    story?: any;
    sprint?: any;
    membership?: any;
    assigneeMembership?: any;
    includeAssignee?: boolean;
  } = {},
) {
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const sprint =
    overrides.sprint !== undefined ? overrides.sprint : activeSprint;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const assigneeMembership =
    overrides.assigneeMembership !== undefined
      ? overrides.assigneeMembership
      : { role: "developer" };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return {
        // user_stories
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 2)
      return {
        // sprints
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: sprint, error: null }),
      };
    if (cnt === 3)
      return {
        // project_members (current user)
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };
    if (cnt === 4 && overrides.includeAssignee)
      return {
        // project_members (assignee)
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: assigneeMembership, error: null }),
      };
    // position: cnt 4 brez assigneeja, cnt 5 z assigneejem
    const positionCnt = overrides.includeAssignee ? 5 : 4;
    if (cnt === positionCnt)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    return {
      // tasks — insert
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "task-1", description: "Implementiraj login" },
        error: null,
      }),
    };
  });
}

// ─── TESTI ────────────────────────────────────────────────────────────────────
describe("POST /api/stories/:storyId/tasks — dodajanje naloge (#14)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ──────────────────────────────────────────────────
  it("201 — uspešno doda nalogo", async () => {
    setupMocks();

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("task-1");
  });

  // ─── #2: Zgodba izven aktivnega sprinta ───────────────────────────────────
  it("400 — zgodba nima sprinta (sprint_id = null)", async () => {
    setupMocks({ story: { ...defaultStory, sprint_id: null } });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprintu/i);
  });

  it("400 — sprint ni aktiven (planned)", async () => {
    const futureSprint = {
      id: "sprint-1",
      start_date: tomorrow,
      end_date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    };
    setupMocks({ sprint: futureSprint });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprintu/i);
  });

  it("400 — sprint je že zaključen (completed)", async () => {
    const pastSprint = {
      id: "sprint-1",
      start_date: new Date(Date.now() - 2 * 86400000)
        .toISOString()
        .split("T")[0],
      end_date: yesterday,
    };
    setupMocks({ sprint: pastSprint });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprintu/i);
  });

  // ─── #3: Realizirana zgodba ───────────────────────────────────────────────
  it("400 — zgodba je realizirana", async () => {
    setupMocks({ story: { ...defaultStory, status: "done" } });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/realiziran/i);
  });

  // ─── #4: Neregularna ocena časa ───────────────────────────────────────────
  it("400 — ocena časa je 0", async () => {
    setupMocks();

    const res = await POST(
      makeRequest({ ...validBody, estimated_hours: 0 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/časa/i);
  });

  it("400 — ocena časa je negativna", async () => {
    setupMocks();

    const res = await POST(
      makeRequest({ ...validBody, estimated_hours: -2 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/časa/i);
  });

  it("400 — ocena časa manjka", async () => {
    setupMocks();

    const res = await POST(makeRequest({ description: "Test" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/časa/i);
  });

  // ─── #5: Dodeljevanje člana razvojne skupine ──────────────────────────────
  it("201 — uspešno doda nalogo z veljavnim assigneejem", async () => {
    setupMocks({ includeAssignee: true });

    const res = await POST(
      makeRequest({ ...validBody, assignee_id: "user-2" }),
      makeContext(),
    );
    expect(res.status).toBe(201);
  });

  it("400 — assignee ni član projekta", async () => {
    setupMocks({ includeAssignee: true, assigneeMembership: null });

    const res = await POST(
      makeRequest({ ...validBody, assignee_id: "user-999" }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/projekt/i);
  });

  it("400 — assignee je product_owner (ne more prevzeti naloge)", async () => {
    setupMocks({
      includeAssignee: true,
      assigneeMembership: { role: "product_owner" },
    });

    const res = await POST(
      makeRequest({ ...validBody, assignee_id: "user-2" }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/razvijalci/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("403 — product_owner ne more dodajati nalog", async () => {
    setupMocks({ membership: { role: "product_owner" } });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(403);
  });

  it("403 — uporabnik ni član projekta", async () => {
    setupMocks({ membership: null });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(403);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(401);
  });

  it("400 — manjka opis naloge", async () => {
    setupMocks();

    const res = await POST(makeRequest({ estimated_hours: 4 }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/opis/i);
  });
});
