import { NextRequest } from "next/server";
import {
  PUT,
  DELETE,
} from "@/app/api/projects/[projectId]/sprints/[sprintId]/route";

// ─── Mock server supabase client ──────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

function makeContext(projectId = "project-1", sprintId = "sprint-1") {
  return { params: Promise.resolve({ projectId, sprintId }) };
}

function makePutRequest(body: object) {
  return new NextRequest(
    "http://localhost/api/projects/project-1/sprints/sprint-1",
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function makeDeleteRequest() {
  return new NextRequest(
    "http://localhost/api/projects/project-1/sprints/sprint-1",
    {
      method: "DELETE",
    },
  );
}

const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const nextWeek = new Date(Date.now() + 7 * 86400000)
  .toISOString()
  .split("T")[0];
const twoWeeks = new Date(Date.now() + 14 * 86400000)
  .toISOString()
  .split("T")[0];
const lastWeek = new Date(Date.now() - 7 * 86400000)
  .toISOString()
  .split("T")[0];

const plannedSprint = {
  id: "sprint-1",
  start_date: tomorrow,
  end_date: nextWeek,
};
const activeSprint = {
  id: "sprint-1",
  start_date: yesterday,
  end_date: tomorrow,
};
const completedSprint = {
  id: "sprint-1",
  start_date: lastWeek,
  end_date: yesterday,
};

const validPutBody = {
  name: "Sprint 1 Updated",
  goal: "Updated goal",
  start_date: tomorrow,
  end_date: nextWeek,
  velocity: 20,
};

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupPutMocks(
  overrides: {
    isScrumMaster?: boolean;
    sprint?: any;
    overlapping?: any[];
    updateResult?: any;
    /** When set on an active sprint, cnt=3 is user_stories count; cnt=4 is update (if count allows). */
    activeStoryCount?: number;
  } = {},
) {
  const {
    isScrumMaster = true,
    sprint = plannedSprint,
    overlapping = [],
    updateResult = { data: { id: "sprint-1", ...validPutBody }, error: null },
    activeStoryCount,
  } = overrides;

  // Determine sprint state the same way the route does
  const isActive =
    sprint && sprint.start_date <= today && sprint.end_date >= today;

  const updateChain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(updateResult),
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    // 1. requireScrumMaster — project_members
    if (cnt === 1)
      return makeReadChain({
        data: isScrumMaster ? { role: "scrum_master" } : { role: "developer" },
        error: null,
      });
    // 2. sprint fetch
    if (cnt === 2) return makeReadChain({ data: sprint, error: null });
    // Active: optional user_stories count (when lowering velocity with stories check)
    if (isActive && cnt === 3 && activeStoryCount !== undefined) {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ count: activeStoryCount, error: null }),
      };
    }
    // Active sprints skip the overlap check, so cnt=3 goes straight to update (unless count above).
    // Planned sprints do the overlap check at cnt=3, then update at cnt=4.
    if (isActive) return updateChain; // cnt=3 or cnt=4 for active
    if (cnt === 3)
      // overlap for planned
      return makeReadChain({ data: overlapping, error: null });
    return updateChain; // cnt=4 for planned
  });
}

function setupDeleteMocks(
  overrides: {
    isScrumMaster?: boolean;
    sprint?: any;
  } = {},
) {
  const { isScrumMaster = true, sprint = plannedSprint } = overrides;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return makeReadChain({
        data: isScrumMaster ? { role: "scrum_master" } : { role: "developer" },
        error: null,
      });
    if (cnt === 2) return makeReadChain({ data: sprint, error: null });
    // delete
    return {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
  });
}

// ─── PUT /api/projects/:projectId/sprints/:sprintId ───────────────────────────
describe("PUT /api/projects/:projectId/sprints/:sprintId — vzdrževanje sprinta (#7)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── Regularen potek ──────────────────────────────────────────────────────
  it("200 — scrum master uspešno posodobi datum planiranega sprinta", async () => {
    setupPutMocks();
    const res = await PUT(makePutRequest(validPutBody), makeContext());
    expect(res.status).toBe(200);
  });

  it("200 — scrum master uspešno posodobi hitrost planiranega sprinta", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest({ ...validPutBody, velocity: 42 }),
      makeContext(),
    );
    expect(res.status).toBe(200);
  });

  it("200 — scrum master posodobi samo hitrost aktivnega sprinta", async () => {
    setupPutMocks({ sprint: activeSprint });
    const res = await PUT(
      makePutRequest({ ...validPutBody, velocity: 15 }),
      makeContext(),
    );
    expect(res.status).toBe(200);
  });

  it("200 — active sprint: can lower velocity when no stories assigned", async () => {
    setupPutMocks({
      sprint: { ...activeSprint, velocity: 20 },
      activeStoryCount: 0,
    });
    const res = await PUT(makePutRequest({ velocity: 10 }), makeContext());
    expect(res.status).toBe(200);
  });

  it("400 — active sprint: cannot lower velocity when stories are assigned", async () => {
    setupPutMocks({
      sprint: { ...activeSprint, velocity: 20 },
      activeStoryCount: 2,
    });
    const res = await PUT(makePutRequest({ velocity: 10 }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be decreased|user stories/i);
  });

  // ─── Validacija datumov ───────────────────────────────────────────────────
  it("400 — končni datum pred začetnim", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest({
        ...validPutBody,
        start_date: nextWeek,
        end_date: tomorrow,
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/končni datum|end date/i);
  });

  it("400 — začetni datum v preteklosti", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest({
        ...validPutBody,
        start_date: yesterday,
        end_date: nextWeek,
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/preteklosti|past/i);
  });

  it("400 — zaključenega sprinta ni mogoče urejati", async () => {
    setupPutMocks({ sprint: completedSprint });
    const res = await PUT(makePutRequest(validPutBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/zaključenega|completed sprint/i);
  });

  // ─── Prekrivanje ──────────────────────────────────────────────────────────
  it("409 — prekrivanje z drugim sprintom", async () => {
    setupPutMocks({ overlapping: [{ id: "sprint-2" }] });
    const res = await PUT(makePutRequest(validPutBody), makeContext());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/prekriva|overlaps/i);
  });

  // ─── Hitrost ──────────────────────────────────────────────────────────────
  it("400 — neveljavna hitrost (negativna)", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest({ ...validPutBody, velocity: -5 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/hitrost|velocity/i);
  });

  it("400 — hitrost previsoka (> 100)", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest({ ...validPutBody, velocity: 101 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/previsoka|too high/i);
  });

  // ─── Pravice ──────────────────────────────────────────────────────────────
  it("403 — developer ne more urejati sprinta", async () => {
    setupPutMocks({ isScrumMaster: false });
    const res = await PUT(makePutRequest(validPutBody), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("404 — sprint ne obstaja", async () => {
    setupPutMocks({ sprint: null });
    const res = await PUT(makePutRequest(validPutBody), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ne obstaja|does not exist/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PUT(makePutRequest(validPutBody), makeContext());
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/projects/:projectId/sprints/:sprintId ───────────────────────
describe("DELETE /api/projects/:projectId/sprints/:sprintId — brisanje sprinta (#7)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — scrum master uspešno izbriše planiran sprint", async () => {
    setupDeleteMocks();
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/uspešno izbrisan|successfully deleted/i);
  });

  it("400 — aktivnega sprinta ni mogoče izbrisati", async () => {
    setupDeleteMocks({ sprint: activeSprint });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/že začel|already started/i);
  });

  it("400 — zaključenega sprinta ni mogoče izbrisati", async () => {
    setupDeleteMocks({ sprint: completedSprint });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/že začel|already started/i);
  });

  it("403 — developer ne more brisati sprinta", async () => {
    setupDeleteMocks({ isScrumMaster: false });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("404 — sprint ne obstaja", async () => {
    setupDeleteMocks({ sprint: null });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ne obstaja|does not exist/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(401);
  });
});
