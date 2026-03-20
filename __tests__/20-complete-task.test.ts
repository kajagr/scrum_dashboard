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
    data: { id: "task-1", status: "completed" },
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return {
        // tasks — fetch task
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: task, error: null }),
      };
    if (cnt === 2)
      return {
        // user_stories — fetch story
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 3)
      return {
        // project_members — check membership
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
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

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("PATCH /api/tasks/:taskId — complete task (#20)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Successful completion ────────────────────────────────────────────
  it("200 — successfully completes a task", async () => {
    setupMocks();

    const res = await PATCH(
      makeRequest({ status: "completed" }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("completed");
  });

  // ─── #2: Story already done ───────────────────────────────────────────────
  it("200 — status updates to completed regardless of story status", async () => {
    setupMocks({
      story: { ...defaultStory, status: "done" },
    });

    const res = await PATCH(
      makeRequest({ status: "completed" }),
      makeContext(),
    );

    expect(res.status).toBe(200);
  });

  // ─── #3: Any project member can mark as completed ─────────────────────────
  it("200 — project member can mark task status as completed", async () => {
    setupMocks({
      task: { ...defaultTask, assignee_id: "other-user", is_accepted: true },
      membership: { role: "scrum_master" },
    });

    const res = await PATCH(
      makeRequest({ status: "completed" }),
      makeContext(),
    );

    expect(res.status).toBe(200);
  });

  // ─── Invalid statuses ─────────────────────────────────────────────────────
  it("400 — invalid status", async () => {
    setupMocks();

    const res = await PATCH(
      makeRequest({ status: "invalid_status" }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid status/i);
  });

  it("400 — missing status and action", async () => {
    setupMocks();

    const res = await PATCH(makeRequest({}), makeContext());

    expect(res.status).toBe(400);
  });

  // ─── Access ───────────────────────────────────────────────────────────────
  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(
      makeRequest({ status: "completed" }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });

  it("403 — user is not a project member", async () => {
    setupMocks({ membership: null });

    const res = await PATCH(
      makeRequest({ status: "completed" }),
      makeContext(),
    );

    expect(res.status).toBe(403);
  });

  it("404 — task does not exist", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await PATCH(
      makeRequest({ status: "completed" }),
      makeContext(),
    );

    expect(res.status).toBe(404);
  });
});
