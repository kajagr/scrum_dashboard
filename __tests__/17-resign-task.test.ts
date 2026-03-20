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
// Route uses .is("deleted_at", null) on tasks + user_stories queries,
// so every read chain needs the .is() stub as well.
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(), // ← was missing; caused silent failures
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
const defaultTask = {
  id: "task-1",
  user_story_id: "story-1",
  status: "assigned",
  assignee_id: "user-1",
  is_accepted: true,
};

const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  sprint_id: "sprint-1",
  status: "in_progress",
};

const defaultMembership = { role: "developer" };

const defaultUpdateResult = {
  data: {
    id: "task-1",
    status: "unassigned",
    assignee_id: null,
    is_accepted: false,
  },
  error: null,
};

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    task?: Partial<typeof defaultTask>;
    story?: Partial<typeof defaultStory>;
    membership?: { role: string } | null;
    updateResult?: { data: any; error: any };
  } = {},
) {
  const task = { ...defaultTask, ...overrides.task };
  const story = { ...defaultStory, ...overrides.story };
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const updateResult = overrides.updateResult ?? defaultUpdateResult;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: task, error: null }); // tasks
    if (cnt === 2) return makeReadChain({ data: story, error: null }); // user_stories
    if (cnt === 3) return makeReadChain({ data: membership, error: null }); // project_members
    return makeUpdateChain(updateResult); // tasks UPDATE
  });
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("PATCH /api/tasks/:taskId — resign from task (#17)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Successful resign ────────────────────────────────────────────────
  it("200 — successfully resigns from task", async () => {
    setupMocks();

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("unassigned");
    expect(body.assignee_id).toBeNull();
    expect(body.is_accepted).toBe(false);
  });

  // ─── #2: Task does not belong to current user ─────────────────────────────
  it("400 — cannot resign from task assigned to a different user", async () => {
    setupMocks({
      task: { ...defaultTask, assignee_id: "other-user", is_accepted: true },
    });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/owner/i);
  });

  it("400 — cannot resign from a task that has not been accepted (is_accepted = false)", async () => {
    setupMocks({
      task: { ...defaultTask, is_accepted: false },
    });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/owner/i);
  });

  // ─── #3: Another developer can accept a resigned task ────────────────────
  it("200 — another developer can accept a resigned task", async () => {
    const unassignedTask = {
      ...defaultTask,
      assignee_id: null,
      is_accepted: false,
      status: "unassigned",
    };

    // story must carry sprint_id so the route can query the sprint
    const storyWithSprint = {
      ...defaultStory,
      sprint_id: "sprint-1",
    };

    const activeSprint = {
      start_date: "2020-01-01",
      end_date: "2099-12-31",
    };

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return makeReadChain({ data: unassignedTask, error: null }); // tasks
      if (cnt === 2)
        return makeReadChain({ data: storyWithSprint, error: null }); // user_stories
      if (cnt === 3)
        return makeReadChain({ data: { role: "developer" }, error: null }); // project_members
      if (cnt === 4) return makeReadChain({ data: activeSprint, error: null }); // sprints
      return makeUpdateChain({
        // tasks UPDATE
        data: {
          id: "task-1",
          assignee_id: "user-2",
          is_accepted: true,
          status: "assigned",
        },
        error: null,
      });
    });

    // Another developer (user-2) accepts the task
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignee_id).toBe("user-2");
    expect(body.is_accepted).toBe(true);
    expect(body.status).toBe("assigned");
  });

  // ─── Additional tests ─────────────────────────────────────────────────────
  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("403 — user is not a project member", async () => {
    setupMocks({ membership: null });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("404 — task does not exist", async () => {
    mockFrom.mockImplementationOnce(() =>
      makeReadChain({ data: null, error: null }),
    );

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
