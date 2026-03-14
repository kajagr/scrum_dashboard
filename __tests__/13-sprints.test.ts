import { NextRequest } from "next/server";
import { POST } from "@/app/api/projects/[projectId]/backlog/assign/route";

// ─── Mock stanje ──────────────────────────────────────────────────────────────
const mockGetUser = jest.fn();
const mockSprintMaybeSingle = jest.fn();

let mockStoriesResult: { data: any; error: any };
let mockAlreadyInSprintResult: { data: any; error: any };
let mockUpdateResult: { error: any };

// ─── Mock Supabase ────────────────────────────────────────────────────────────
function createUserStoriesBuilder() {
  const builder: any = {
    mode: null,
    columns: null,
    updatePayload: null,
    eqFilters: [] as Array<[string, any]>,
    inFilter: null as null | { column: string; values: any[] },

    select(cols: string) {
      this.mode = "select";
      this.columns = cols;
      return this;
    },

    update(payload: object) {
      this.mode = "update";
      this.updatePayload = payload;
      return this;
    },

    in(column: string, values: any[]) {
      this.inFilter = { column, values };
      return this;
    },

    eq(column: string, value: any) {
      this.eqFilters.push([column, value]);

      // update(...).in(...).eq(...)
      if (this.mode === "update") {
        return Promise.resolve(mockUpdateResult);
      }

      // select("id, project_id, status, sprint_id, story_points").in(...).eq(...)
      if (
        this.mode === "select" &&
        typeof this.columns === "string" &&
        this.columns.includes("id, project_id, status, sprint_id, story_points")
      ) {
        return Promise.resolve(mockStoriesResult);
      }

      // select("story_points").eq(...).eq(...)
      if (
        this.mode === "select" &&
        this.columns === "story_points"
      ) {
        if (this.eqFilters.length < 2) return this;
        return Promise.resolve(mockAlreadyInSprintResult);
      }

      return this;
    },
  };

  return builder;
}

const mockFrom = jest.fn((table: string) => {
  if (table === "sprints") {
    const sprintBuilder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      maybeSingle: mockSprintMaybeSingle,
    };
    return sprintBuilder;
  }

  if (table === "user_stories") {
    return createUserStoriesBuilder();
  }

  throw new Error(`Unexpected table: ${table}`);
});

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
  ),
}));

// ─── Helper funkcije ──────────────────────────────────────────────────────────
function makeRequest(body: object) {
  return new NextRequest(
    "http://localhost/api/projects/test-project/backlog/assign",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function makeContext(projectId = "test-project") {
  return { params: Promise.resolve({ projectId }) };
}

// ─── Testi ────────────────────────────────────────────────────────────────────
describe("POST /api/projects/:projectId/backlog/assign", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: uporabnik prijavljen
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    // Default: obstaja aktiven sprint
    mockSprintMaybeSingle.mockResolvedValue({
      data: {
        id: "sprint-1",
        name: "Sprint 1",
        start_date: "2026-03-01",
        end_date: "2026-03-31",
        velocity: 20,
      },
      error: null,
    });

    // Default: izbrane zgodbe so veljavne
    mockStoriesResult = {
      data: [
        {
          id: "story-1",
          project_id: "test-project",
          status: "todo",
          sprint_id: null,
          story_points: 5,
        },
        {
          id: "story-2",
          project_id: "test-project",
          status: "in_progress",
          sprint_id: null,
          story_points: 8,
        },
      ],
      error: null,
    };

    // Default: v sprintu še ni nič takega, da bi preseglo velocity
    mockAlreadyInSprintResult = {
      data: [{ story_points: 3 }],
      error: null,
    };

    // Default: update uspe
    mockUpdateResult = {
      error: null,
    };
  });

  // ─── #1: Regularen potek ──────────────────────────────────────────────────
  it("200 — uspešno dodeli zgodbe aktivnemu sprintu", async () => {
    const res = await POST(
      makeRequest({
        storyIds: ["story-1", "story-2"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assignedCount).toBe(2);
    expect(body.sprint.id).toBe("sprint-1");
    expect(body.message).toMatch(/successfully assigned/i);
  });

  // ─── #2: Zgodbe nimajo določene časovne zahtevnosti ───────────────────────
  it("400 — zgodba nima določenih story points", async () => {
    mockStoriesResult = {
      data: [
        {
          id: "story-1",
          project_id: "test-project",
          status: "todo",
          sprint_id: null,
          story_points: null,
        },
      ],
      error: null,
    };

    const res = await POST(
      makeRequest({
        storyIds: ["story-1"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/story points/i);
  });

  // ─── #3: Že realizirane zgodbe ────────────────────────────────────────────
  it("400 — zgodba je že realizirana", async () => {
    mockStoriesResult = {
      data: [
        {
          id: "story-1",
          project_id: "test-project",
          status: "done",
          sprint_id: null,
          story_points: 5,
        },
      ],
      error: null,
    };

    const res = await POST(
      makeRequest({
        storyIds: ["story-1"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/completed stories/i);
  });

  // ─── #4: Že dodeljene aktivnemu Sprintu ───────────────────────────────────
  it("400 — zgodba je že dodeljena aktivnemu sprintu", async () => {
    mockStoriesResult = {
      data: [
        {
          id: "story-1",
          project_id: "test-project",
          status: "todo",
          sprint_id: "sprint-1",
          story_points: 5,
        },
      ],
      error: null,
    };

    const res = await POST(
      makeRequest({
        storyIds: ["story-1"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/already assigned to the active sprint/i);
  });

  // ─── Dodatni smiselni testi ───────────────────────────────────────────────
  it("401 — uporabnik ni prijavljen", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await POST(
      makeRequest({
        storyIds: ["story-1"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });

  it("400 — storyIds je prazen array", async () => {
    const res = await POST(
      makeRequest({
        storyIds: [],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/non-empty array/i);
  });

  it("400 — ni aktivnega sprinta", async () => {
    mockSprintMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const res = await POST(
      makeRequest({
        storyIds: ["story-1"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/no active sprint/i);
  });

  it("400 — dodajanje zgodb preseže velocity sprinta", async () => {
    mockAlreadyInSprintResult = {
      data: [{ story_points: 15 }],
      error: null,
    };

    mockStoriesResult = {
      data: [
        {
          id: "story-1",
          project_id: "test-project",
          status: "todo",
          sprint_id: null,
          story_points: 4,
        },
        {
          id: "story-2",
          project_id: "test-project",
          status: "todo",
          sprint_id: null,
          story_points: 3,
        },
      ],
      error: null,
    };

    const res = await POST(
      makeRequest({
        storyIds: ["story-1", "story-2"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/exceed the sprint velocity/i);
  });

  it("403 — uporabnik nima pravic za dodelitev zgodb", async () => {
    mockUpdateResult = {
      error: { message: "row-level security policy violation" },
    };

    const res = await POST(
      makeRequest({
        storyIds: ["story-1", "story-2"],
      }),
      makeContext(),
    );

    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toMatch(/don't have permission/i);
  });
});