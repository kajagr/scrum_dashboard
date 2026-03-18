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

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    task?: any;
    story?: any;
    membership?: any;
    updateResult?: any;
  } = {},
) {
  const task = { ...defaultTask, ...overrides.task };
  const story = { ...defaultStory, ...overrides.story };
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const updateResult = overrides.updateResult ?? {
    data: {
      id: "task-1",
      status: "unassigned",
      assignee_id: null,
      is_accepted: false,
    },
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: task, error: null }),
      };
    if (cnt === 2)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 3)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };
    return {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(updateResult),
    };
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
  // Integration with #16 — simulates that after resign the task is unassigned
  // and another developer can accept it (action: "accept")
  it("200 — another developer can accept a resigned task", async () => {
    const unassignedTask = {
      ...defaultTask,
      assignee_id: null,
      is_accepted: false,
      status: "unassigned",
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
        return {
          // tasks
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: unassignedTask, error: null }),
        };
      if (cnt === 2)
        return {
          // user_stories
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: defaultStory, error: null }),
        };
      if (cnt === 3)
        return {
          // project_members
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: { role: "developer" }, error: null }),
        };
      if (cnt === 4)
        return {
          // sprints — check active sprint
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: activeSprint, error: null }),
        };
      return {
        // tasks — update (accept)
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: "task-1",
            assignee_id: "user-2",
            is_accepted: true,
            status: "assigned",
          },
          error: null,
        }),
      };
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
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
