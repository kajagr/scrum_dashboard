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

// ─── Helper functions ─────────────────────────────────────────────────────────
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

// ─── Shared mock builder ──────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(), // ← route calls .is("deleted_at", null)
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
  };
}

function makeUpdateChain(resolvedValue: { data: any; error: any }) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Default data ─────────────────────────────────────────────────────────────
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

// ─── Setup mocks ──────────────────────────────────────────────────────────────
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
    if (cnt === 1) return makeReadChain({ data: task, error: null }); // tasks
    if (cnt === 2) return makeReadChain({ data: story, error: null }); // user_stories
    if (cnt === 3) return makeReadChain({ data: membership, error: null }); // project_members
    if (cnt === 4) return makeReadChain({ data: sprint, error: null }); // sprints
    return makeUpdateChain(updateResult); // tasks UPDATE
  });
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("PATCH /api/tasks/:taskId — accept task (#16)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Successful accept ────────────────────────────────────────────────
  it("200 — successfully accepts an unassigned task", async () => {
    setupMocks();

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_accepted).toBe(true);
    expect(body.assignee_id).toBe("user-1");
    expect(body.status).toBe("assigned");
  });

  it("200 — accepts a task that was suggested to the current user", async () => {
    setupMocks({
      task: { ...defaultTask, assignee_id: "user-1", is_accepted: false },
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(200);
  });

  // ─── #2: Task already accepted ────────────────────────────────────────────
  it("400 — task is already accepted", async () => {
    setupMocks({
      task: { ...defaultTask, is_accepted: true, assignee_id: "user-2" },
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already been accepted/i);
  });

  // ─── #3: Task assigned to another member ──────────────────────────────────
  it("400 — task is suggested to another member", async () => {
    setupMocks({
      task: { ...defaultTask, assignee_id: "user-99", is_accepted: false },
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/another member/i);
  });

  // ─── Additional tests ─────────────────────────────────────────────────────
  it("403 — product_owner cannot accept a task", async () => {
    setupMocks({ membership: { role: "product_owner" } });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master|developer/i);
  });

  it("400 — sprint is not active", async () => {
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
    expect(body.error).toMatch(/active sprint/i);
  });

  it("400 — story has no sprint", async () => {
    setupMocks({ story: { ...defaultStory, sprint_id: null } });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprint/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("404 — task does not exist", async () => {
    mockFrom.mockImplementationOnce(() =>
      makeReadChain({ data: null, error: null }),
    );

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
