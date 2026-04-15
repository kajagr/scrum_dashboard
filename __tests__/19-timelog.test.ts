import { NextRequest } from "next/server";
import { GET as getMeTimelogs } from "@/app/api/users/me/timelogs/route";
import { PUT } from "@/app/api/timelogs/[id]/route";
import {
  GET as getTaskTimelogs,
  POST,
} from "@/app/api/tasks/[taskId]/timelogs/route";
import { PATCH } from "@/app/api/tasks/[taskId]/remaining-time/route";

// ─── Mock createClient (@/lib/supabase/server) ────────────────────────────────
const mockFrom = jest.fn<any, any>();
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: (...args: any[]) => mockFrom(...args),
      auth: { getUser: mockGetUser },
    }),
  ),
}));

// ─── Mock @supabase/supabase-js (admin client) ────────────────────────────────
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

// ─── Helper: universal fluent chain ──────────────────────────────────────────
// Handles read chains (select/eq/is/order/maybeSingle/single)
// AND write chains (update/insert/eq/select/single)
// AND thenable chains (await without terminal method)
function makeChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

// ─── Request / context helpers ────────────────────────────────────────────────
function makeGetRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

function makePostRequest(url: string, body: object) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePutRequest(url: string, body: object) {
  return new NextRequest(url, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePatchRequest(url: string, body: object) {
  return new NextRequest(url, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeContext(params: Record<string, string>): any {
  return { params: Promise.resolve(params) };
}

// ─── Shared fixture data ──────────────────────────────────────────────────────
const CURRENT_USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const TASK_ID = "task-abc";
const STORY_ID = "story-xyz";
const TIMELOG_ID = "log-001";

const activeTask = {
  id: TASK_ID,
  user_story_id: STORY_ID,
  assignee_id: CURRENT_USER_ID,
  is_accepted: true,
  remaining_time: 4,
};

const activeStory = { id: STORY_ID, status: "in_progress" };
const doneStory = { id: STORY_ID, status: "done" };

const existingLog = {
  id: TIMELOG_ID,
  task_id: TASK_ID,
  user_id: CURRENT_USER_ID,
  hours: 2,
};
const updatedLog = {
  id: TIMELOG_ID,
  task_id: TASK_ID,
  user_id: CURRENT_USER_ID,
  hours: 3,
  date: "2026-04-07",
  logged_at: new Date().toISOString(),
};
const newLog = {
  id: "log-002",
  task_id: TASK_ID,
  user_id: CURRENT_USER_ID,
  hours: 2,
  date: "2026-04-07",
  logged_at: new Date().toISOString(),
};

// ─── GET /api/users/me/timelogs ───────────────────────────────────────────────

describe("GET /api/users/me/timelogs — pregled časovnih vnosov trenutnega uporabnika (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    });
  });

  // DB calls: server client → time_logs select with join (thenable)
  function setupGetMeTimelogs(overrides: { logs?: any[]; dbError?: any } = {}) {
    const { logs = [], dbError = null } = overrides;
    mockFrom.mockImplementation(() =>
      makeChain({ data: dbError ? null : logs, error: dbError }),
    );
  }

  it("200 — vrne seznam vnosov z informacijami o nalogi in zgodbi", async () => {
    const logs = [
      {
        id: TIMELOG_ID,
        task_id: TASK_ID,
        hours: 2,
        date: "2026-04-07",
        task: {
          id: TASK_ID,
          title: "Naloga 1",
          description: null,
          remaining_time: 4,
          user_story: {
            id: STORY_ID,
            title: "Zgodba 1",
            status: "in_progress",
          },
        },
      },
    ];
    setupGetMeTimelogs({ logs });

    const res = await getMeTimelogs(
      makeGetRequest("http://localhost/api/users/me/timelogs"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].task).toHaveProperty("title");
    expect(body[0].task).toHaveProperty("user_story");
  });

  it("200 — vrne prazen seznam če ni vnosov", async () => {
    setupGetMeTimelogs({ logs: [] });
    const res = await getMeTimelogs(
      makeGetRequest("http://localhost/api/users/me/timelogs"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("200 — filtrira po from_date in to_date", async () => {
    setupGetMeTimelogs({ logs: [] });
    const res = await getMeTimelogs(
      makeGetRequest(
        "http://localhost/api/users/me/timelogs?from_date=2026-04-01&to_date=2026-04-07",
      ),
    );
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.gte).toHaveBeenCalledWith("date", "2026-04-01");
    expect(chain.lte).toHaveBeenCalledWith("date", "2026-04-07");
  });

  it("200 — filtrira samo po from_date (brez to_date)", async () => {
    setupGetMeTimelogs({ logs: [] });
    const res = await getMeTimelogs(
      makeGetRequest(
        "http://localhost/api/users/me/timelogs?from_date=2026-04-01",
      ),
    );
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.gte).toHaveBeenCalledWith("date", "2026-04-01");
    expect(chain.lte).not.toHaveBeenCalled();
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await getMeTimelogs(
      makeGetRequest("http://localhost/api/users/me/timelogs"),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/unauthorized/i);
  });

  it("500 — DB napaka pri pridobivanju", async () => {
    setupGetMeTimelogs({ dbError: { message: "DB error" } });
    const res = await getMeTimelogs(
      makeGetRequest("http://localhost/api/users/me/timelogs"),
    );
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/tasks/:taskId/timelogs ─────────────────────────────────────────

describe("GET /api/tasks/:taskId/timelogs — pregled vnosov za nalogo (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    });
  });

  // DB calls:
  //   cnt=1: tasks fetch   → maybeSingle
  //   cnt=2: time_logs fetch → thenable
  function setupGetTaskTimelogs(
    overrides: { task?: any; logs?: any[]; taskError?: any } = {},
  ) {
    const { task = activeTask, logs = [], taskError = null } = overrides;
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return makeChain({ data: taskError ? null : task, error: taskError });
      return makeChain({ data: logs, error: null });
    });
  }

  it("200 — assignee dobi seznam svojih vnosov za nalogo", async () => {
    const logs = [
      {
        id: TIMELOG_ID,
        task_id: TASK_ID,
        user_id: CURRENT_USER_ID,
        hours: 2,
        date: "2026-04-07",
        logged_at: "",
      },
    ];
    setupGetTaskTimelogs({ logs });
    const res = await getTaskTimelogs(
      makeGetRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].task_id).toBe(TASK_ID);
  });

  it("403 — uporabnik ni assignee naloge", async () => {
    setupGetTaskTimelogs({
      task: { ...activeTask, assignee_id: OTHER_USER_ID },
    });
    const res = await getTaskTimelogs(
      makeGetRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/dostopa/i);
  });

  it("404 — naloga ne obstaja", async () => {
    setupGetTaskTimelogs({ task: null });
    const res = await getTaskTimelogs(
      makeGetRequest(`http://localhost/api/tasks/nonexistent/timelogs`),
      makeContext({ taskId: "nonexistent" }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/najdena/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await getTaskTimelogs(
      makeGetRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/tasks/:taskId/timelogs ────────────────────────────────────────

describe("POST /api/tasks/:taskId/timelogs — dodajanje ur (#19)", () => {
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .split("T")[0];
  const tomorrow = new Date(Date.now() + 86_400_000)
    .toISOString()
    .split("T")[0];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    });
  });

  // DB calls:
  //   cnt=1: tasks fetch             → maybeSingle
  //   cnt=2: user_stories fetch      → maybeSingle
  //   cnt=3: existing log check      → maybeSingle
  //   cnt=4: insert OR update log    → single
  //   cnt=5: allLogs fetch           → thenable
  //   cnt=6: task update             → thenable
  function setupPostTimelogs(
    overrides: {
      task?: any;
      story?: any;
      existingLog?: any;
      resultLog?: any;
    } = {},
  ) {
    const {
      task = activeTask,
      story = activeStory,
      existingLog: existing = null,
      resultLog = existing ? updatedLog : newLog,
    } = overrides;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: task, error: null });
      if (cnt === 2) return makeChain({ data: story, error: null });
      if (cnt === 3) return makeChain({ data: existing, error: null });
      if (cnt === 4) return makeChain({ data: resultLog, error: null });
      if (cnt === 5) return makeChain({ data: [{ hours: 2 }], error: null });
      return makeChain({ data: null, error: null }); // task update
    });
  }

  it("200 — uspešno doda nov vnos ur", async () => {
    setupPostTimelogs();
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.hours).toBe(2);
  });

  it("200 — prišteje ure obstoječemu vnosu za isti dan", async () => {
    setupPostTimelogs({
      existingLog: { id: TIMELOG_ID, hours: 1 },
      resultLog: updatedLog, // hours = 3 (1 + 2)
    });
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(TIMELOG_ID);
    expect(body.hours).toBe(3);
  });

  it("400 — hours_spent = 0 ni dovoljeno (AC2)", async () => {
    setupPostTimelogs();
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: 0,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/večje od 0/i);
  });

  it("400 — negativne ure niso dovoljene (AC2)", async () => {
    setupPostTimelogs();
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: -1,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("400 — datum v prihodnosti ni dovoljen (AC2)", async () => {
    setupPostTimelogs();
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: tomorrow,
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/prihodnosti/i);
  });

  it("400 — manjkajoč datum (AC2)", async () => {
    setupPostTimelogs();
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/datum/i);
  });

  it("403 — naloga ni bila sprejeta (is_accepted = false) (AC3)", async () => {
    setupPostTimelogs({ task: { ...activeTask, is_accepted: false } });
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/sprejeta/i);
  });

  it("403 — uporabnik ni assignee naloge (AC3)", async () => {
    setupPostTimelogs({ task: { ...activeTask, assignee_id: OTHER_USER_ID } });
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(403);
  });

  it("400 — naloga je v zaključeni zgodbi (AC4)", async () => {
    setupPostTimelogs({ story: doneStory });
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/zaključena/i);
  });

  it("404 — naloga ne obstaja", async () => {
    setupPostTimelogs({ task: null });
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/nonexistent/timelogs`, {
        date: yesterday,
        hours_spent: 2,
      }),
      makeContext({ taskId: "nonexistent" }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/najdena/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(
      makePostRequest(`http://localhost/api/tasks/${TASK_ID}/timelogs`, {
        date: yesterday,
        hours_spent: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/timelogs/:id ────────────────────────────────────────────────────

describe("PUT /api/timelogs/:id — urejanje ur (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    });
  });

  // DB calls:
  //   cnt=1: time_logs fetch (log)       → maybeSingle
  //   cnt=2: tasks fetch (task)          → is, maybeSingle
  //   cnt=3: user_stories fetch (story)  → maybeSingle
  //   cnt=4: time_logs update            → select.single
  //   cnt=5: time_logs allLogs fetch     → thenable
  //   cnt=6: tasks update                → thenable
  function setupPutTimelog(
    overrides: {
      log?: any;
      task?: any;
      story?: any;
      updateError?: any;
    } = {},
  ) {
    const {
      log = existingLog,
      task = activeTask,
      story = activeStory,
      updateError = null,
    } = overrides;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: log, error: null });
      if (cnt === 2) return makeChain({ data: task, error: null });
      if (cnt === 3) return makeChain({ data: story, error: null });
      if (cnt === 4) return makeChain({ data: updatedLog, error: updateError });
      if (cnt === 5) return makeChain({ data: [{ hours: 3 }], error: null });
      return makeChain({ data: null, error: null }); // task update
    });
  }

  it("200 — lastnik uspešno posodobi ure (AC1)", async () => {
    setupPutTimelog();
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 3,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).hours).toBe(3);
  });

  it("400 — hours_spent = 0 ni dovoljeno (AC2)", async () => {
    setupPutTimelog();
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 0,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/večje od 0/i);
  });

  it("400 — negativne ure niso dovoljene (AC2)", async () => {
    setupPutTimelog();
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: -2,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("400 — manjkajoče polje hours_spent (AC2)", async () => {
    setupPutTimelog();
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {}),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("403 — drug uporabnik ne more urejati tujega vnosa (AC3)", async () => {
    setupPutTimelog({ log: { ...existingLog, user_id: OTHER_USER_ID } });
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 3,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/dostopa/i);
  });

  it("403 — naloga ni bila sprejeta s strani uporabnika (AC3)", async () => {
    setupPutTimelog({ task: { ...activeTask, is_accepted: false } });
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 3,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/sprejeta/i);
  });

  it("400 — urejanje blokirano ker je zgodba zaključena (AC4)", async () => {
    setupPutTimelog({ story: doneStory });
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 3,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/zaključena/i);
  });

  it("404 — vnos ne obstaja", async () => {
    setupPutTimelog({ log: null });
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/nonexistent`, {
        hours_spent: 3,
      }),
      makeContext({ id: "nonexistent" }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/najden/i);
  });

  it("404 — naloga ne obstaja", async () => {
    setupPutTimelog({ task: null });
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 3,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(404);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 3,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(401);
  });

  it("500 — DB napaka pri posodabljanju", async () => {
    setupPutTimelog({ updateError: { message: "DB update failed" } });
    const res = await PUT(
      makePutRequest(`http://localhost/api/timelogs/${TIMELOG_ID}`, {
        hours_spent: 3,
      }),
      makeContext({ id: TIMELOG_ID }),
    );
    expect(res.status).toBe(500);
  });
});

// ─── PATCH /api/tasks/:taskId/remaining-time ─────────────────────────────────

describe("PATCH /api/tasks/:taskId/remaining-time — preostali čas (#19)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    });
  });

  // DB calls:
  //   cnt=1: tasks fetch  → is, maybeSingle
  //   cnt=2: tasks update → select.single
  function setupPatchRemainingTime(
    overrides: { task?: any; updateError?: any } = {},
  ) {
    const { task = activeTask, updateError = null } = overrides;
    const updatedTask = { id: TASK_ID, remaining_time: 2 };
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: task, error: null });
      return makeChain({ data: updatedTask, error: updateError });
    });
  }

  it("200 — lastnik uspešno nastavi preostali čas (AC1)", async () => {
    setupPatchRemainingTime();
    const res = await PATCH(
      makePatchRequest(`http://localhost/api/tasks/${TASK_ID}/remaining-time`, {
        remaining_time: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).remaining_time).toBe(2);
  });

  it("200 — remaining_time = 0 je veljavno (naloga dokončana)", async () => {
    setupPatchRemainingTime();
    const res = await PATCH(
      makePatchRequest(`http://localhost/api/tasks/${TASK_ID}/remaining-time`, {
        remaining_time: 0,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(200);
  });

  it("400 — negativna vrednost ni dovoljena (AC2)", async () => {
    setupPatchRemainingTime();
    const res = await PATCH(
      makePatchRequest(`http://localhost/api/tasks/${TASK_ID}/remaining-time`, {
        remaining_time: -1,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/0 ali več/i);
  });

  it("400 — manjkajoče polje remaining_time (AC2)", async () => {
    setupPatchRemainingTime();
    const res = await PATCH(
      makePatchRequest(
        `http://localhost/api/tasks/${TASK_ID}/remaining-time`,
        {},
      ),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("403 — naloga ni sprejeta (is_accepted = false) (AC3)", async () => {
    setupPatchRemainingTime({ task: { ...activeTask, is_accepted: false } });
    const res = await PATCH(
      makePatchRequest(`http://localhost/api/tasks/${TASK_ID}/remaining-time`, {
        remaining_time: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/sprejemnik/i);
  });

  it("403 — uporabnik ni assignee naloge (AC3)", async () => {
    setupPatchRemainingTime({
      task: { ...activeTask, assignee_id: OTHER_USER_ID },
    });
    const res = await PATCH(
      makePatchRequest(`http://localhost/api/tasks/${TASK_ID}/remaining-time`, {
        remaining_time: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(403);
  });

  it("404 — naloga ne obstaja", async () => {
    setupPatchRemainingTime({ task: null });
    const res = await PATCH(
      makePatchRequest(
        `http://localhost/api/tasks/nonexistent/remaining-time`,
        { remaining_time: 2 },
      ),
      makeContext({ taskId: "nonexistent" }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/najdena/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PATCH(
      makePatchRequest(`http://localhost/api/tasks/${TASK_ID}/remaining-time`, {
        remaining_time: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(401);
  });

  it("500 — DB napaka pri posodabljanju", async () => {
    setupPatchRemainingTime({ updateError: { message: "DB failed" } });
    const res = await PATCH(
      makePatchRequest(`http://localhost/api/tasks/${TASK_ID}/remaining-time`, {
        remaining_time: 2,
      }),
      makeContext({ taskId: TASK_ID }),
    );
    expect(res.status).toBe(500);
  });
});
