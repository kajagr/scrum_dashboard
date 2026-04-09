import { NextRequest } from "next/server";
import { POST as CONFIRM } from "@/app/api/stories/[storyId]/confirm/route";

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

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
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

function makeContext(storyId = "story-1") {
  return { params: Promise.resolve({ storyId }) };
}

function makePostRequest() {
  return new NextRequest("http://localhost/api/stories/story-1/confirm", {
    method: "POST",
  });
}

const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const lastWeek = new Date(Date.now() - 7 * 86400000)
  .toISOString()
  .split("T")[0];
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

const activeSprint = { start_date: yesterday, end_date: tomorrow };
// "inactive" for this endpoint means sprint hasn't started yet (start_date > today)
const inactiveSprint = { start_date: tomorrow, end_date: nextWeek };

const readyStory = {
  id: "story-1",
  project_id: "project-1",
  status: "ready",
  sprint_id: "sprint-1",
};
const doneStory = { ...readyStory, status: "done" };
const inProgressStory = { ...readyStory, status: "in_progress" };
const backlogStory = { ...readyStory, status: "backlog", sprint_id: null };

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    story?: any;
    membership?: any;
    sprint?: any;
  } = {},
) {
  const story = overrides.story !== undefined ? overrides.story : readyStory;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : { role: "product_owner" };
  const sprint =
    overrides.sprint !== undefined ? overrides.sprint : activeSprint;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: story, error: null }); // story
    if (cnt === 2) return makeReadChain({ data: membership, error: null }); // membership
    if (cnt === 3) return makeReadChain({ data: sprint, error: null }); // sprint
    // update — confirm uses supabase (not admin)
    return {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { ...story, status: "done" },
        error: null,
      }),
    };
  });
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("POST /api/stories/:storyId/confirm — potrjevanje zgodbe (#25)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — product owner uspešno potrdi zgodbo", async () => {
    setupMocks();
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/potrjena/i);
  });

  it("400 — že potrjena zgodba (status done)", async () => {
    setupMocks({ story: doneStory });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/že potrjena/i);
  });

  it("400 — zgodba ni ready (status in_progress)", async () => {
    setupMocks({ story: inProgressStory });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ready/i);
  });

  it("400 — zgodba ni dodeljena sprintu", async () => {
    setupMocks({ story: backlogStory });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprintu/i);
  });

  it("400 — zgodba ni v aktivnem sprintu", async () => {
    setupMocks({ sprint: inactiveSprint });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/aktivnem sprintu/i);
  });

  it("403 — scrum master ne more potrjevati zgodb", async () => {
    setupMocks({ membership: { role: "scrum_master" } });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/product owner/i);
  });

  it("403 — developer ne more potrjevati zgodb", async () => {
    setupMocks({ membership: { role: "developer" } });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("404 — zgodba ne obstaja", async () => {
    setupMocks({ story: null });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ne obstaja/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await CONFIRM(makePostRequest(), makeContext());
    expect(res.status).toBe(401);
  });
});
