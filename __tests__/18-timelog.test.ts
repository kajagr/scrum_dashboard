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

// ─── Helper funkcije ──────────────────────────────────────────────────────────
function makeRequest(url = "http://localhost/api/tasks/task-1/start") {
  return new NextRequest(url, { method: "POST" });
}

function makeContext(taskId = "task-1") {
  return { params: Promise.resolve({ taskId }) };
}

// ─── Default mock podatki ─────────────────────────────────────────────────────
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

// ─── TESTI ZA START ───────────────────────────────────────────────────────────
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

  // ─── #1: Regularen potek ───────────────────────────────────────────────────
  it("200 — uspešno začne delo na nalogi", async () => {
    setupStartMocks();

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_active).toBe(true);
  });

  // ─── #2: Naloga ni vaša ────────────────────────────────────────────────────
  it("400 — naloga ni sprejeta s strani trenutnega uporabnika", async () => {
    setupStartMocks({
      task: { ...defaultTask, assignee_id: "drug-user", is_accepted: true },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/vaša/i);
  });

  it("400 — naloga ni sprejeta (is_accepted = false)", async () => {
    setupStartMocks({
      task: { ...defaultTask, is_accepted: false },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/vaša/i);
  });

  // ─── #3: Zgodba je zaključena ──────────────────────────────────────────────
  it("400 — zgodba je že zaključena", async () => {
    setupStartMocks({
      story: { ...defaultStory, status: "done" },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/zaključena/i);
  });

  // ─── #4: Naloga je že aktivna ─────────────────────────────────────────────
  it("400 — naloga je že aktivna", async () => {
    setupStartMocks({
      task: { ...defaultTask, is_active: true },
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/aktivna/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await START(makeRequest(), makeContext());
    expect(res.status).toBe(401);
  });
});

// ─── TESTI ZA STOP ────────────────────────────────────────────────────────────
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
    active_since: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 uri nazaj
  };

  function setupStopMocks(overrides: { task?: any; existingLog?: any } = {}) {
    const task = { ...activeTask, ...overrides.task };
    const existingLog = overrides.existingLog ?? null;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          // tasks — pridobi nalogo
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: task, error: null }),
        };
      if (cnt === 2)
        return {
          // time_logs — preveri obstoječi vpis
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
          // time_logs — seštej vse ure
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

  // ─── #1: Regularen potek ───────────────────────────────────────────────────
  it("200 — uspešno konča delo in zabeleži čas", async () => {
    setupStopMocks();

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_active).toBe(false);
  });

  // ─── #2: Agregacija časa po dnevu ─────────────────────────────────────────
  it("200 — prišteje ure k obstoječemu vpisu za danes", async () => {
    setupStopMocks({
      existingLog: { id: "log-1", hours: 1.5 }, // že 1.5h zabeleženih danes
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(200);
  });

  // ─── #3: Naloga ni aktivna ────────────────────────────────────────────────
  it("400 — naloga ni aktivna", async () => {
    setupStopMocks({
      task: { ...activeTask, is_active: false },
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/aktivna/i);
  });

  // ─── #4: Naloga ni vaša ────────────────────────────────────────────────────
  it("400 — naloga pripada drugemu uporabniku", async () => {
    setupStopMocks({
      task: { ...activeTask, assignee_id: "drug-user" },
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/vaša/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await STOP(
      makeRequest("http://localhost/api/tasks/task-1/stop"),
      makeContext(),
    );
    expect(res.status).toBe(401);
  });
});
