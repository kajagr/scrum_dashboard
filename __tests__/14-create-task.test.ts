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

// ─── Helper functions ─────────────────────────────────────────────────────────
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

// ─── Default data ─────────────────────────────────────────────────────────────
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
  description: "Implement login",
  estimated_hours: 4,
};

// ─── Shared mock builders ─────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Setup mocks ──────────────────────────────────────────────────────────────
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
      // user_stories: .select().eq().is().maybeSingle()
      return makeReadChain({ data: story, error: null });

    if (cnt === 2)
      // sprints: .select().eq().maybeSingle()
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: sprint, error: null }),
      };

    if (cnt === 3)
      // project_members (current user): .select().eq().eq().maybeSingle()
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };

    if (cnt === 4 && overrides.includeAssignee)
      // project_members (assignee): .select().eq().eq().maybeSingle()
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: assigneeMembership, error: null }),
      };

    // position query: .select().eq().is().order().limit() — .limit() is terminal
    const positionCnt = overrides.includeAssignee ? 5 : 4;
    if (cnt === positionCnt)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(), // ← route calls .is("deleted_at", null) here
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

    // tasks — insert
    return {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "task-1", description: "Implement login" },
        error: null,
      }),
    };
  });
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("POST /api/stories/:storyId/tasks — create task (#14)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Successful task creation ────────────────────────────────────────
  it("201 — successfully creates a task", async () => {
    setupMocks();

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("task-1");
  });

  // ─── #2: Story not in an active sprint ───────────────────────────────────
  it("400 — story has no sprint (sprint_id = null)", async () => {
    setupMocks({ story: { ...defaultStory, sprint_id: null } });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/active sprint/i);
  });

  it("400 — sprint is not active (planned)", async () => {
    const futureSprint = {
      id: "sprint-1",
      start_date: tomorrow,
      end_date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    };
    setupMocks({ sprint: futureSprint });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/active sprint/i);
  });

  it("400 — sprint is already completed", async () => {
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
    expect(body.error).toMatch(/active sprint/i);
  });

  // ─── #3: Completed story ──────────────────────────────────────────────────
  it("400 — story is completed", async () => {
    setupMocks({ story: { ...defaultStory, status: "done" } });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/completed story/i);
  });

  // ─── #4: Invalid estimated hours ─────────────────────────────────────────
  it("400 — estimated hours is zero", async () => {
    setupMocks();

    const res = await POST(
      makeRequest({ ...validBody, estimated_hours: 0 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/estimated hours/i);
  });

  it("400 — estimated hours is negative", async () => {
    setupMocks();

    const res = await POST(
      makeRequest({ ...validBody, estimated_hours: -2 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/estimated hours/i);
  });

  it("400 — estimated hours is missing", async () => {
    setupMocks();

    const res = await POST(makeRequest({ description: "Test" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/estimated hours/i);
  });

  // ─── #5: Assigning a team member ─────────────────────────────────────────
  it("201 — successfully creates task with valid assignee", async () => {
    setupMocks({ includeAssignee: true });

    const res = await POST(
      makeRequest({ ...validBody, assignee_id: "user-2" }),
      makeContext(),
    );
    expect(res.status).toBe(201);
  });

  it("400 — assignee is not a project member", async () => {
    setupMocks({ includeAssignee: true, assigneeMembership: null });

    const res = await POST(
      makeRequest({ ...validBody, assignee_id: "user-999" }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("400 — assignee is product_owner (cannot be assigned tasks)", async () => {
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
    expect(body.error).toMatch(/developers and scrum masters/i);
  });

  // ─── Additional tests ─────────────────────────────────────────────────────
  it("403 — product_owner cannot add tasks", async () => {
    setupMocks({ membership: { role: "product_owner" } });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum masters and developers/i);
  });

  it("403 — user is not a project member", async () => {
    setupMocks({ membership: null });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(makeRequest(validBody), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("400 — missing task description", async () => {
    setupMocks();

    const res = await POST(makeRequest({ estimated_hours: 4 }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/description/i);
  });
});
