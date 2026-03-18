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

// ─── Helper functions ─────────────────────────────────────────────────────────
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

function futureDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function pastDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /api/projects/:projectId/sprints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user is authenticated
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    // Default: no overlapping sprints
    mockGte.mockResolvedValue({ data: [], error: null });
    // Default: insert succeeds
    mockSingle.mockResolvedValue({
      data: { id: "sprint-1", name: "Sprint 1" },
      error: null,
    });
  });

  // ─── #1: Successful sprint creation ──────────────────────────────────────
  it("201 — successfully creates sprint with valid data", async () => {
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
    expect(body.name).toBe("Sprint 1");
  });

  // ─── #2: End date before start date ──────────────────────────────────────
  it("400 — end date is before start date", async () => {
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
    expect(body.error).toMatch(/end date/i);
  });

  // ─── #3: Start date in the past ──────────────────────────────────────────
  it("400 — start date is in the past", async () => {
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
    expect(body.error).toMatch(/past/i);
  });

  // ─── #4: Invalid velocity ─────────────────────────────────────────────────
  it("400 — velocity is negative", async () => {
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

  it("400 — velocity is zero", async () => {
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

  it("400 — velocity is too high (> 100)", async () => {
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

  // ─── #5: Overlapping sprints ──────────────────────────────────────────────
  it("409 — sprint overlaps with an existing sprint", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({
        data: [{ id: "existing-sprint", name: "Existing Sprint" }],
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
    expect(body.error).toMatch(/overlaps/i);
  });

  // ─── Additional tests ─────────────────────────────────────────────────────
  it("401 — unauthenticated user", async () => {
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
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("400 — missing required fields", async () => {
    const res = await POST(
      makeRequest({ name: "Sprint 1" }), // missing start_date and end_date
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("201 — creates sprint without velocity (optional field)", async () => {
    const res = await POST(
      makeRequest({
        name: "Sprint 1",
        start_date: futureDate(1),
        end_date: futureDate(14),
        // velocity omitted
      }),
      makeContext(),
    );

    expect(res.status).toBe(201);
  });

  it("403 — RLS error on insert", async () => {
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
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });
});
