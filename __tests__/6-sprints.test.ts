import { NextRequest } from "next/server";
import { POST } from "@/app/api/projects/[projectId]/sprints/route";

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockSingle = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockEq = jest.fn();
const mockLte = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();

const mockFrom = jest.fn(() => ({
  select: mockSelect.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  lte: mockLte.mockReturnThis(),
  gte: mockGte.mockReturnThis(),
  order: mockOrder.mockReturnThis(),
  single: mockSingle,
}));

const mockGetUser = jest.fn();

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
  return new NextRequest("http://localhost/api/projects/test-project/sprints", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(projectId = "test-project") {
  return { params: Promise.resolve({ projectId }) };
}

// Datum v prihodnosti
function futureDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

// Datum v preteklosti
function pastDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

// ─── Testi ────────────────────────────────────────────────────────────────────
describe("POST /api/projects/:projectId/sprints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user je prijavljen
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    // Default: ni prekrivajočih sprintov
    mockGte.mockResolvedValue({ data: [], error: null });
    // Default: insert uspe
    mockSingle.mockResolvedValue({
      data: { id: "sprint-1", name: "Sprint 1" },
      error: null,
    });
  });

  // ─── #1: Običajen potek ───────────────────────────────────────────────────
  it("201 — uspešno ustvari sprint z veljavnimi podatki", async () => {
    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
        velocity: 20,
      }),
      makeContext(),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("sprint-1");
  });

  // ─── #2: Končni datum pred začetnim ──────────────────────────────────────
  it("400 — končni datum je pred začetnim", async () => {
    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(10),
        end_date: futureDate(5),
        velocity: 20,
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/končni datum/i);
  });

  // ─── #3: Začetni datum v preteklosti ─────────────────────────────────────
  it("400 — začetni datum je v preteklosti", async () => {
    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: pastDate(5),
        end_date: futureDate(10),
        velocity: 20,
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/preteklosti/i);
  });

  // ─── #4: Neveljavna hitrost ───────────────────────────────────────────────
  it("400 — velocity je negativen", async () => {
    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
        velocity: -5,
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/velocity/i);
  });

  it("400 — velocity je 0", async () => {
    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
        velocity: 0,
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/velocity/i);
  });

  it("400 — velocity je previsok (> 100)", async () => {
    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
        velocity: 101,
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/velocity/i);
  });

  // ─── #5: Prekrivanje sprintov ─────────────────────────────────────────────
  it("409 — sprint se prekriva z obstoječim", async () => {
    // Simuliraj da obstaja prekravajoči sprint — mock mora vrniti na koncu verige
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({
        data: [{ id: "existing-sprint", name: "Obstoječi sprint" }],
        error: null,
      }),
      insert: jest.fn().mockReturnThis(),
      single: mockSingle,
      order: jest.fn().mockReturnThis(),
    }));

    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
        velocity: 20,
      }),
      makeContext(),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/prekriva/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("401 — uporabnik ni prijavljen", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
      }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });

  it("400 — manjkajoča obvezna polja", async () => {
    const res = await POST(
      makeRequest({ name: "Sprint 1" }), // manjkata start_date in end_date
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  it("403 — RLS napaka pri insertu", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "row-level security policy" },
    });

    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
        velocity: 20,
      }),
      makeContext(),
    );

    expect(res.status).toBe(403);
  });
});
