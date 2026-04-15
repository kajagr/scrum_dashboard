import { NextRequest } from "next/server";
import { GET } from "@/app/api/projects/[projectId]/burndown/route";

// ─── Mock @/lib/supabase/server ───────────────────────────────────────────────
const mockFrom = jest.fn<any, any>();
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (...args: any[]) => mockFrom(...args),
    }),
  ),
}));

// ─── Mock @supabase/supabase-js (admin — za time_logs) ───────────────────────
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeContext(params: Record<string, string>): any {
  return { params: Promise.resolve(params) };
}

function makeGetRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const PROJECT_ID = "project-1";
const SPRINT_ID = "sprint-1";

const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
const lastWeek = new Date(Date.now() - 7 * 86_400_000)
  .toISOString()
  .split("T")[0];
const nextWeek = new Date(Date.now() + 7 * 86_400_000)
  .toISOString()
  .split("T")[0];

const activeSprint = {
  id: SPRINT_ID,
  name: "Sprint 1",
  start_date: yesterday,
  end_date: tomorrow,
};

const completedSprint = {
  id: "sprint-old",
  name: "Sprint 0",
  start_date: lastWeek,
  end_date: yesterday,
};

const stories = [{ id: "story-1" }, { id: "story-2" }];
const tasks = [
  { id: "task-1", estimated_hours: 4 },
  { id: "task-2", estimated_hours: 6 },
];
// totalEstimated = 10

// ─── Setup helper ─────────────────────────────────────────────────────────────
// DB calls (supabase) — vary by whether sprintId query param is provided:
//
// WITH ?sprintId:
//   cnt=1: sprints fetch by id  → maybeSingle
//   cnt=2: user_stories         → thenable
//   cnt=3: tasks                → thenable  (skip if no stories)
//
// WITHOUT ?sprintId:
//   cnt=1: active sprint        → maybeSingle
//   cnt=2: (if no active) last sprint → maybeSingle
//   cnt=?: user_stories, tasks  → thenable
//
// Admin calls:
//   cnt=1: time_logs            → thenable  (skip if no tasks)

function setupGetMocks(
  overrides: {
    sprintById?: any;
    activeSprint?: any;
    lastSprint?: any;
    stories?: any[];
    tasks?: any[];
    timeLogs?: any[];
  } = {},
) {
  const {
    sprintById = activeSprint,
    activeSprint: active = activeSprint,
    lastSprint = null,
    stories: storiesData = stories,
    tasks: tasksData = tasks,
    timeLogs = [],
  } = overrides;

  let cnt = 0;
  mockFrom.mockImplementation((table: string) => {
    cnt++;

    // Sprint lookups
    if (table === "sprints") {
      // Could be sprintById lookup, active sprint, or last sprint
      if (cnt === 1 && sprintById !== undefined) {
        // sprintId query param path
        return makeChain({ data: sprintById, error: null });
      }
      if (cnt === 1) return makeChain({ data: active, error: null });
      if (cnt === 2) return makeChain({ data: lastSprint, error: null });
    }

    if (table === "user_stories")
      return makeChain({ data: storiesData, error: null });
    if (table === "tasks") return makeChain({ data: tasksData, error: null });

    return makeChain({ data: null, error: null });
  });

  mockAdminFrom.mockImplementation(() =>
    makeChain({ data: timeLogs, error: null }),
  );
}

// Simpler setup used when we don't need to distinguish table names
function setupMocksByCount(
  sprintData: any,
  storiesData: any[],
  tasksData: any[],
  timeLogs: any[],
  noActiveSprint = false,
) {
  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return makeChain({
        data: noActiveSprint ? null : sprintData,
        error: null,
      });
    if (cnt === 2 && noActiveSprint)
      return makeChain({ data: sprintData, error: null });
    // user_stories
    if (cnt === (noActiveSprint ? 3 : 2))
      return makeChain({ data: storiesData, error: null });
    // tasks
    return makeChain({ data: tasksData, error: null });
  });

  mockAdminFrom.mockImplementation(() =>
    makeChain({ data: timeLogs, error: null }),
  );
}

// ─── GET /api/projects/:projectId/burndown (#29) ──────────────────────────────

describe("GET /api/projects/:projectId/burndown — Burn-Down diagram (#29)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── Regularen potek / struktura odgovora ─────────────────────────────────

  it("200 — vrne pravilno strukturo odgovora", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("sprint");
    expect(body).toHaveProperty("totalEstimated");
    expect(body).toHaveProperty("days");
    expect(Array.isArray(body.days)).toBe(true);
  });

  it("200 — vrne podatke za aktiven sprint (brez sprintId parametra)", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.id).toBe(SPRINT_ID);
    expect(body.sprint.name).toBe("Sprint 1");
  });

  it("200 — vrne podatke za specifičen sprint (?sprintId=...)", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(
        `http://localhost/api/projects/${PROJECT_ID}/burndown?sprintId=${SPRINT_ID}`,
      ),
      makeContext({ projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.id).toBe(SPRINT_ID);
  });

  it("200 — fallback na zadnji zaključen sprint ko ni aktivnega", async () => {
    setupMocksByCount(completedSprint, stories, tasks, [], true);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.id).toBe("sprint-old");
  });

  // ─── Pravilnost izračunov ─────────────────────────────────────────────────

  it("pravilno izračuna totalEstimated kot vsoto estimated_hours nalog", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);
    // tasks: 4 + 6 = 10

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    expect(body.totalEstimated).toBe(10);
  });

  it("idealna linija začne pri totalEstimated in konča pri 0", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const days = body.days;

    // Prvi dan = totalEstimated
    expect(days[0].ideal).toBe(10);
    // Zadnji dan ≈ 0
    expect(days[days.length - 1].ideal).toBe(0);
  });

  it("idealna linija je linearna (vsak dan enakomerno manjša)", async () => {
    // Sprint: yesterday → tomorrow = 2 dni
    // Dan 0: ideal=10, Dan 1: ideal=5, Dan 2: ideal=0
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const ideals = body.days.map((d: any) => d.ideal);

    // Preveri da vsak naslednji ideal je manjši ali enak
    for (let i = 1; i < ideals.length; i++) {
      expect(ideals[i]).toBeLessThanOrEqual(ideals[i - 1]);
    }
  });

  it("pravilno agregira vložene ure po dnevih (cumulative logged)", async () => {
    const timeLogs = [
      { date: yesterday, hours: 3 },
      { date: yesterday, hours: 2 }, // skupaj yesterday: 5
    ];
    setupMocksByCount(activeSprint, stories, tasks, timeLogs);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const yesterdayEntry = body.days.find((d: any) => d.date === yesterday);
    expect(yesterdayEntry).toBeDefined();
    expect(yesterdayEntry.logged).toBe(5);
  });

  it("remaining = totalEstimated - cumulative logged (ne gre pod 0)", async () => {
    const timeLogs = [{ date: yesterday, hours: 4 }];
    setupMocksByCount(activeSprint, stories, tasks, timeLogs);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const yesterdayEntry = body.days.find((d: any) => d.date === yesterday);
    // totalEstimated=10, logged=4 → remaining=6
    expect(yesterdayEntry.remaining).toBe(6);
  });

  it("remaining ne gre pod 0 tudi če so ure večje od estimated", async () => {
    const timeLogs = [{ date: yesterday, hours: 999 }];
    setupMocksByCount(activeSprint, stories, tasks, timeLogs);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const yesterdayEntry = body.days.find((d: any) => d.date === yesterday);
    expect(yesterdayEntry.remaining).toBe(0);
  });

  it("prihodnji dnevi imajo remaining = null in isFuture = true", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const futureDays = body.days.filter((d: any) => d.isFuture);

    futureDays.forEach((d: any) => {
      expect(d.remaining).toBeNull();
      expect(d.isFuture).toBe(true);
    });
  });

  it("označuje današnji dan z isToday = true", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const todayEntry = body.days.find((d: any) => d.isToday);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.date).toBe(today);
  });

  // ─── Scenarij: sprint brez nalog ─────────────────────────────────────────

  it("200 — sprint brez zgodb/nalog vrne totalEstimated = 0", async () => {
    setupMocksByCount(activeSprint, [], [], []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEstimated).toBe(0);
    expect(body.days.every((d: any) => d.ideal === 0)).toBe(true);
  });

  it("200 — dni so urejeni od start_date do end_date sprinta", async () => {
    setupMocksByCount(activeSprint, stories, tasks, []);

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    const body = await res.json();
    const dates = body.days.map((d: any) => d.date);

    expect(dates[0]).toBe(activeSprint.start_date);
    expect(dates[dates.length - 1]).toBe(activeSprint.end_date);

    // Preveri da so datumi naraščajoče urejeni
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  // ─── Napake ───────────────────────────────────────────────────────────────

  it("404 — ni nobenega sprinta za projekt", async () => {
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      // active sprint → null, last sprint → null
      return makeChain({ data: null, error: null });
    });

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/no sprint found/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(
      makeGetRequest(`http://localhost/api/projects/${PROJECT_ID}/burndown`),
      makeContext({ projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(401);
  });
});
