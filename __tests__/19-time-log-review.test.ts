import { NextRequest } from "next/server";
import { GET } from "@/app/api/users/me/timelogs/route";
import { PUT } from "@/app/api/timelogs/[id]/route";
import { POST } from "@/app/api/tasks/[taskId]/timelogs/route";
import { PATCH } from "@/app/api/tasks/[taskId]/remaining-time/route";

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

// ─── Shared mock builders ─────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    // terminal for list queries
    then: undefined as any,
  };
}

function makeListChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  };
  // Make the chain itself thenable so `await supabase.from(...).select(...).eq(...)` works
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

function makeUpdateChain(resolvedValue: { data: any; error: any }) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
}

function makeInsertChain(resolvedValue: { data: any; error: any }) {
  return {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Default data ─────────────────────────────────────────────────────────────
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

const defaultLog = {
  id: "log-1",
  task_id: "task-1",
  user_id: "user-1",
  hours: 2,
  date: yesterday,
  logged_at: new Date().toISOString(),
};

const defaultTask = {
  id: "task-1",
  user_story_id: "story-1",
  assignee_id: "user-1",
  is_accepted: true,
};

const defaultStory = {
  id: "story-1",
  status: "in_progress",
};

// ─── GET /api/users/me/timelogs ───────────────────────────────────────────────
describe("GET /api/users/me/timelogs (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("200 — returns time logs for current user", async () => {
    const logsData = [
      { ...defaultLog, task: { id: "task-1", title: "Task A", description: null, remaining_time: null, user_story: { id: "story-1", title: "Story 1", status: "in_progress" } } },
    ];
    mockFrom.mockImplementation(() => makeListChain({ data: logsData, error: null }));

    const req = new NextRequest("http://localhost/api/users/me/timelogs");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
  });

  it("200 — applies from_date and to_date filters", async () => {
    mockFrom.mockImplementation(() => makeListChain({ data: [], error: null }));

    const req = new NextRequest(
      `http://localhost/api/users/me/timelogs?from_date=${yesterday}&to_date=${today}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new NextRequest("http://localhost/api/users/me/timelogs");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── PUT /api/timelogs/:id ────────────────────────────────────────────────────
describe("PUT /api/timelogs/:id (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  function makeContext(id = "log-1") {
    return { params: Promise.resolve({ id }) };
  }

  function setupPutMocks(overrides: { log?: any; task?: any; story?: any; updateResult?: any } = {}) {
    const log = { ...defaultLog, ...overrides.log };
    const task = { ...defaultTask, ...overrides.task };
    const story = { ...defaultStory, ...overrides.story };
    const updateResult = overrides.updateResult ?? {
      data: { ...log, hours: 3.5 },
      error: null,
    };

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeReadChain({ data: log, error: null }); // time_logs fetch
      if (cnt === 2) return makeReadChain({ data: task, error: null }); // tasks fetch
      if (cnt === 3) return makeReadChain({ data: story, error: null }); // user_stories fetch
      if (cnt === 4) return makeUpdateChain(updateResult); // time_logs update
      // tasks logged_hours update
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ hours: 3.5 }], error: null }),
        update: jest.fn().mockReturnThis(),
      };
    });
  }

  it("200 — successfully updates hours", async () => {
    setupPutMocks();

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 3.5 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(200);
  });

  // Acceptance criterion: hours_spent > 0
  it("400 — rejects hours_spent = 0", async () => {
    setupPutMocks();

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 0 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("400 — rejects negative hours_spent", async () => {
    setupPutMocks();

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: -1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(400);
  });

  // Acceptance criterion: editing blocked if task not accepted by user
  it("403 — blocked when task not accepted by current user", async () => {
    setupPutMocks({
      task: { ...defaultTask, is_accepted: false },
    });

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("403 — blocked when current user is not the assignee", async () => {
    setupPutMocks({
      task: { ...defaultTask, assignee_id: "other-user" },
    });

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(403);
  });

  it("403 — blocked when log belongs to another user", async () => {
    setupPutMocks({
      log: { ...defaultLog, user_id: "other-user" },
    });

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // Acceptance criterion: editing blocked if story is completed (status = done)
  it("400 — blocked when story is done (realized)", async () => {
    setupPutMocks({
      story: { ...defaultStory, status: "done" },
    });

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(401);
  });

  it("404 — log not found", async () => {
    mockFrom.mockImplementationOnce(() => makeReadChain({ data: null, error: null }));

    const req = new NextRequest("http://localhost/api/timelogs/log-1", {
      method: "PUT",
      body: JSON.stringify({ hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeContext());
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/tasks/:taskId/timelogs ─────────────────────────────────────────
describe("POST /api/tasks/:taskId/timelogs (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  function makeContext(taskId = "task-1") {
    return { params: Promise.resolve({ taskId }) };
  }

  function setupPostMocks(overrides: { task?: any; story?: any; existingLog?: any } = {}) {
    const task = { ...defaultTask, ...overrides.task };
    const story = { ...defaultStory, ...overrides.story };
    const existingLog = overrides.existingLog ?? null;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeReadChain({ data: task, error: null }); // tasks
      if (cnt === 2) return makeReadChain({ data: story, error: null }); // user_stories
      if (cnt === 3) return makeReadChain({ data: existingLog, error: null }); // existing log check
      if (cnt === 4) {
        // update existing or insert new
        if (existingLog) {
          return makeUpdateChain({ data: { ...existingLog, hours: existingLog.hours + 2 }, error: null });
        }
        return makeInsertChain({ data: { ...defaultLog, date: today }, error: null });
      }
      // logged_hours recalculation
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ hours: 2 }], error: null }),
        update: jest.fn().mockReturnThis(),
      };
    });
  }

  // Acceptance criterion: normal flow works end-to-end
  it("200 — successfully logs time for a task", async () => {
    setupPostMocks();

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: today, hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(200);
  });

  it("200 — adds to existing log for the same day", async () => {
    setupPostMocks({ existingLog: { id: "log-1", task_id: "task-1", user_id: "user-1", hours: 1.5, date: today } });

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: today, hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(200);
  });

  // Acceptance criterion: hours_spent > 0
  it("400 — rejects hours_spent = 0", async () => {
    setupPostMocks();

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: today, hours_spent: 0 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(400);
  });

  // Acceptance criterion: date not in future
  it("400 — rejects future date", async () => {
    setupPostMocks();

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: tomorrow, hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/prihodnosti/i);
  });

  // Acceptance criterion: blocked if task not accepted by user
  it("403 — blocked when task not accepted", async () => {
    setupPostMocks({ task: { ...defaultTask, is_accepted: false } });

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: today, hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("403 — blocked when current user is not assignee", async () => {
    setupPostMocks({ task: { ...defaultTask, assignee_id: "other-user" } });

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: today, hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(403);
  });

  // Acceptance criterion: blocked if story is completed
  it("400 — blocked when story is done (realized)", async () => {
    setupPostMocks({ story: { ...defaultStory, status: "done" } });

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: today, hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new NextRequest("http://localhost/api/tasks/task-1/timelogs", {
      method: "POST",
      body: JSON.stringify({ date: today, hours_spent: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/tasks/:taskId/remaining-time ──────────────────────────────────
describe("PATCH /api/tasks/:taskId/remaining-time (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  function makeContext(taskId = "task-1") {
    return { params: Promise.resolve({ taskId }) };
  }

  function setupPatchMocks(overrides: { task?: any; updateResult?: any } = {}) {
    const task = { ...defaultTask, ...overrides.task };
    const updateResult = overrides.updateResult ?? {
      data: { id: "task-1", remaining_time: 1.5 },
      error: null,
    };

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeReadChain({ data: task, error: null }); // tasks fetch
      return makeUpdateChain(updateResult); // tasks update
    });
  }

  it("200 — successfully updates remaining time", async () => {
    setupPatchMocks();

    const req = new NextRequest("http://localhost/api/tasks/task-1/remaining-time", {
      method: "PATCH",
      body: JSON.stringify({ remaining_time: 1.5 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remaining_time).toBe(1.5);
  });

  it("200 — allows remaining_time = 0", async () => {
    setupPatchMocks({ updateResult: { data: { id: "task-1", remaining_time: 0 }, error: null } });

    const req = new NextRequest("http://localhost/api/tasks/task-1/remaining-time", {
      method: "PATCH",
      body: JSON.stringify({ remaining_time: 0 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(200);
  });

  it("400 — rejects negative remaining_time", async () => {
    setupPatchMocks();

    const req = new NextRequest("http://localhost/api/tasks/task-1/remaining-time", {
      method: "PATCH",
      body: JSON.stringify({ remaining_time: -1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(400);
  });

  it("403 — blocked when task not accepted by current user", async () => {
    setupPatchMocks({ task: { ...defaultTask, is_accepted: false } });

    const req = new NextRequest("http://localhost/api/tasks/task-1/remaining-time", {
      method: "PATCH",
      body: JSON.stringify({ remaining_time: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("403 — blocked when current user is not assignee", async () => {
    setupPatchMocks({ task: { ...defaultTask, assignee_id: "other-user" } });

    const req = new NextRequest("http://localhost/api/tasks/task-1/remaining-time", {
      method: "PATCH",
      body: JSON.stringify({ remaining_time: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(403);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new NextRequest("http://localhost/api/tasks/task-1/remaining-time", {
      method: "PATCH",
      body: JSON.stringify({ remaining_time: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(401);
  });

  it("404 — task not found", async () => {
    mockFrom.mockImplementationOnce(() => makeReadChain({ data: null, error: null }));

    const req = new NextRequest("http://localhost/api/tasks/task-1/remaining-time", {
      method: "PATCH",
      body: JSON.stringify({ remaining_time: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(404);
  });
});
