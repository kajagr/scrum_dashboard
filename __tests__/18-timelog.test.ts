import { NextRequest } from "next/server";
import { POST as START } from "@/app/api/tasks/[taskId]/start/route";
import { POST as STOP } from "@/app/api/tasks/[taskId]/stop/route";

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
function makeRequest(url = "http://localhost/api/tasks/task-1/start") {
  return new NextRequest(url, { method: "POST" });
}

function makeContext(taskId = "task-1") {
  return { params: Promise.resolve({ taskId }) };
}

// ─── Default mock data ────────────────────────────────────────────────────────
const defaultTask = {
  id: "task-1",
  user_story_id: "story-1",
  status: "assigned",
  assignee_id: "user-1",
  is_accepted: true,
  is_active: false,
  active_since: null,
};

const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  status: "in_progress",
};

// ─── START TESTS ──────────────────────────────────────────────────────────────
describe("POST /api/tasks/:taskId/start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  function setupStartMocks(
    overrides: {
      task?: any;
      story?: any;
      activeTasks?: any[];
      updateResult?: any;
    } = {},
  ) {
    const task = { ...defaultTask, ...overrides.task };
    const story = { ...defaultStory, ...overrides.story };
    const activeTasks = overrides.activeTasks ?? [];
    const updateResult = overrides.updateResult ?? {
      data: { id: "task-1", is_active: true },
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
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: story, error: null }),
        };
      if (cnt === 3) {
        const secondEq = jest
          .fn()
          .mockResolvedValue({ data: activeTasks, error: null });
        const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
        return { select: jest.fn().mockReturnValue({ eq: firstEq }) };
      }
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(updateResult),
      };
    });
  }

  // ─── #1: Successful start ─────────────────────────────────────────────────
  it("200 — successfully starts working on a task", async () => {
    setupStartMocks();

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_active).toBe(true);
  });

  // ─── #2: Task does not belong to current user ─────────────────────────────
  it("400 — task is not accepted by the current user (different assignee)", async () => {
    setupStartMocks({
      task: { ...defaultTask, assignee_id: "other-user", is_accepted: true },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not yours/i);
  });

  it("400 — task is not accepted (is_accepted = false)", async () => {
    setupStartMocks({
      task: { ...defaultTask, is_accepted: false },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not yours/i);
  });

  // ─── #3: Story is completed ───────────────────────────────────────────────
  it("400 — story is already completed", async () => {
    setupStartMocks({
      story: { ...defaultStory, status: "done" },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/completed/i);
  });

  // ─── #4: Task is already active ───────────────────────────────────────────
  it("400 — task is already active", async () => {
    setupStartMocks({
      task: { ...defaultTask, is_active: true },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already active/i);
  });

  // ─── #5: User already has an active task ──────────────────────────────────
  it("400 — user already has another active task", async () => {
    setupStartMocks({
      activeTasks: [{ id: "task-other" }],
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/active task/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── STOP TESTS ───────────────────────────────────────────────────────────────
describe("POST /api/tasks/:taskId/stop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  const activeTask = {
    ...defaultTask,
    is_active: true,
    active_since: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  };

  function setupStopMocks(overrides: { task?: any; existingLog?: any } = {}) {
    const task = { ...activeTask, ...overrides.task };
    const existingLog = overrides.existingLog ?? null;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          // tasks — fetch task
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: task, error: null }),
        };
      if (cnt === 2)
        return {
          // time_logs — check existing log for today
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: existingLog, error: null }),
        };
      if (cnt === 3)
        return existingLog
          ? {
              update: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ error: null }),
            }
          : { insert: jest.fn().mockResolvedValue({ error: null }) };
      if (cnt === 4)
        return {
          // time_logs — sum all logged hours
          select: jest.fn().mockReturnThis(),
          eq: jest
            .fn()
            .mockResolvedValue({ data: [{ hours: 2 }], error: null }),
        };
      return {
        // tasks — update
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "task-1", is_active: false, logged_hours: 2 },
          error: null,
        }),
      };
    });
  }

  // ─── #1: Successful stop ──────────────────────────────────────────────────
  it("200 — successfully stops work and logs time", async () => {
    setupStopMocks();

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_active).toBe(false);
    expect(body.logged_hours).toBe(2);
  });

  // ─── #2: Time aggregation by day ──────────────────────────────────────────
  it("200 — adds hours to existing log entry for today", async () => {
    setupStopMocks({
      existingLog: { id: "log-1", hours: 1.5 }, // already 1.5h logged today
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(200);
  });

  // ─── #3: Task is not active ───────────────────────────────────────────────
  it("400 — task is not active", async () => {
    setupStopMocks({
      task: { ...activeTask, is_active: false },
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not active/i);
  });

  // ─── #4: Task does not belong to current user ─────────────────────────────
  it("400 — task belongs to another user", async () => {
    setupStopMocks({
      task: { ...activeTask, assignee_id: "other-user" },
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not active or does not belong/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});
