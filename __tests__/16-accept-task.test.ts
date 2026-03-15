import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/tasks/[taskId]/route";

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
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(taskId = "task-1") {
  return { params: Promise.resolve({ taskId }) };
}

// ─── Default podatki ──────────────────────────────────────────────────────────
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

const defaultTask = {
  id: "task-1",
  user_story_id: "story-1",
  status: "unassigned",
  assignee_id: null,
  is_accepted: false,
};

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

// ─── Setup mock ───────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    task?: any;
    story?: any;
    sprint?: any;
    membership?: any;
    updateResult?: any;
  } = {},
) {
  const task = overrides.task !== undefined ? overrides.task : defaultTask;
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const sprint =
    overrides.sprint !== undefined ? overrides.sprint : activeSprint;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const updateResult = overrides.updateResult ?? {
    data: {
      id: "task-1",
      is_accepted: true,
      assignee_id: "user-1",
      status: "assigned",
    },
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return {
        // tasks
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: task, error: null }),
      };
    if (cnt === 2)
      return {
        // user_stories
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 3)
      return {
        // project_members
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };
    if (cnt === 4)
      return {
        // sprints
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: sprint, error: null }),
      };
    return {
      // tasks — update
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(updateResult),
    };
  });
}

// ─── TESTI ────────────────────────────────────────────────────────────────────
describe("PATCH /api/tasks/:taskId — sprejemanje naloge (#16)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ──────────────────────────────────────────────────
  it("200 — uspešno sprejme nedodeljeno nalogo", async () => {
    setupMocks();

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_accepted).toBe(true);
    expect(body.assignee_id).toBe("user-1");
    expect(body.status).toBe("assigned");
  });

  it("200 — sprejme nalogo ki je bila predlagana trenutnemu userju", async () => {
    setupMocks({
      task: { ...defaultTask, assignee_id: "user-1", is_accepted: false },
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(200);
  });

  // ─── #2: Naloga je že sprejeta ────────────────────────────────────────────
  it("400 — naloga je že sprejeta", async () => {
    setupMocks({
      task: { ...defaultTask, is_accepted: true, assignee_id: "user-2" },
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprejeta/i);
  });

  // ─── #3: Naloga dodeljena drugemu članu ──────────────────────────────────
  it("400 — naloga je predlagana drugemu članu", async () => {
    setupMocks({
      task: { ...defaultTask, assignee_id: "user-99", is_accepted: false },
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/drugemu/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("403 — product_owner ne more sprejeti naloge", async () => {
    setupMocks({ membership: { role: "product_owner" } });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(403);
  });

  it("400 — sprint ni aktiven", async () => {
    const pastSprint = {
      id: "sprint-1",
      start_date: new Date(Date.now() - 2 * 86400000)
        .toISOString()
        .split("T")[0],
      end_date: yesterday,
    };
    setupMocks({ sprint: pastSprint });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprintu/i);
  });

  it("400 — zgodba nima sprinta", async () => {
    setupMocks({ story: { ...defaultStory, sprint_id: null } });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(401);
  });
});
