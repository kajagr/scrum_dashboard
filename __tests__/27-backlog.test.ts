import { NextRequest } from "next/server";
import { GET } from "@/app/api/projects/[projectId]/backlog/route";

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockStoriesResult = jest.fn();

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
function makeRequest() {
  return new NextRequest("http://localhost/api/projects/test-project/backlog");
}

function makeContext(projectId = "test-project") {
  return { params: Promise.resolve({ projectId }) };
}

function makeStory(overrides = {}) {
  return {
    id: "story-1",
    title: "Test Story",
    description: null,
    acceptance_criteria: null,
    priority: "must_have",
    business_value: 10,
    story_points: 5,
    status: "backlog",
    sprint_id: null,
    position: 1,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

// ─── Testi ────────────────────────────────────────────────────────────────────
describe("GET /api/projects/:projectId/backlog", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: prijavljen user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── Pomožna funkcija za nastavitev mockov ────────────────────────────────

  function setupMocks(activeSprint: any, stories: any[]) {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Prvi klic — sprints (aktivni sprint)
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: activeSprint,
              error: null,
            }),
          }),
        };
      } else {
        // Drugi klic — user_stories (z is("deleted_at", null))
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(), // ✅ dodano
          order: jest.fn().mockResolvedValue({
            data: stories,
            error: null,
          }),
        };
      }
    });
  }

  // ─── #1: Prikaz vseh kategorij ───────────────────────────────────────────
  it("200 — vrne zgodbe v vseh treh kategorijah", async () => {
    const activeSprint = { id: "sprint-1", name: "Sprint 1" };
    const stories = [
      makeStory({ id: "s1", status: "done", sprint_id: null }), // realized
      makeStory({ id: "s2", status: "backlog", sprint_id: "sprint-1" }), // assigned
      makeStory({ id: "s3", status: "backlog", sprint_id: null }), // unassigned
    ];
    setupMocks(activeSprint, stories);

    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.realized).toHaveLength(1);
    expect(body.realized[0].id).toBe("s1");
    expect(body.assigned).toHaveLength(1);
    expect(body.assigned[0].id).toBe("s2");
    expect(body.unassigned).toHaveLength(1);
    expect(body.unassigned[0].id).toBe("s3");
    expect(body.activeSprint.id).toBe("sprint-1");
  });

  // ─── #2: Ni aktivnega sprinta ─────────────────────────────────────────────
  it("200 — brez aktivnega sprinta so vse nerealizirane zgodbe unassigned", async () => {
    const stories = [
      makeStory({ id: "s1", status: "done" }),
      makeStory({ id: "s2", status: "backlog", sprint_id: "old-sprint" }),
      makeStory({ id: "s3", status: "backlog", sprint_id: null }),
    ];
    setupMocks(null, stories);

    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeSprint).toBeNull();
    expect(body.realized).toHaveLength(1);
    expect(body.assigned).toHaveLength(0);
    expect(body.unassigned).toHaveLength(2);
  });

  // ─── #3: Samo realizirane zgodbe ─────────────────────────────────────────
  it("200 — vse zgodbe so realizirane", async () => {
    const stories = [
      makeStory({ id: "s1", status: "done" }),
      makeStory({ id: "s2", status: "done" }),
    ];
    setupMocks(null, stories);

    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.realized).toHaveLength(2);
    expect(body.assigned).toHaveLength(0);
    expect(body.unassigned).toHaveLength(0);
  });

  // ─── #4: Ni zgodb ────────────────────────────────────────────────────────
  it("200 — projekt nima zgodb, vse kategorije so prazne", async () => {
    setupMocks(null, []);

    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.realized).toHaveLength(0);
    expect(body.assigned).toHaveLength(0);
    expect(body.unassigned).toHaveLength(0);
  });

  // ─── #5: Dostop za člane projekta ────────────────────────────────────────
  it("401 — neprijavljen uporabnik ne more videti backloga", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(401);
  });

  // ─── #6: Zgodba dodeljena neaktivnemu sprintu ─────────────────────────────
  it("200 — zgodba dodeljena staremu sprintu gre v unassigned", async () => {
    const activeSprint = { id: "sprint-active", name: "Aktiven sprint" };
    const stories = [
      makeStory({ id: "s1", status: "backlog", sprint_id: "sprint-old" }), // star sprint → unassigned
      makeStory({ id: "s2", status: "backlog", sprint_id: "sprint-active" }), // aktiven → assigned
    ];
    setupMocks(activeSprint, stories);

    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assigned).toHaveLength(1);
    expect(body.assigned[0].id).toBe("s2");
    expect(body.unassigned).toHaveLength(1);
    expect(body.unassigned[0].id).toBe("s1");
  });
});
