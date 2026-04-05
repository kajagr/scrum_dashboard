import { NextRequest } from "next/server";
import { POST as REJECT } from "@/app/api/stories/[storyId]/reject/route";

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

function makeRejectRequest(body?: object) {
  return new NextRequest("http://localhost/api/stories/story-1/reject", {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const lastWeek = new Date(Date.now() - 7 * 86400000)
  .toISOString()
  .split("T")[0];

const activeSprint = { start_date: yesterday, end_date: tomorrow };
const inactiveSprint = { start_date: lastWeek, end_date: yesterday };

const readyStory = {
  id: "story-1",
  project_id: "project-1",
  status: "ready",
  sprint_id: "sprint-1",
};
const doneStory = { ...readyStory, status: "done" };
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
    return makeReadChain({ data: sprint, error: null }); // sprint
  });

  // reject uses supabaseAdmin for update + insert
  mockAdminFrom.mockImplementation(() => ({
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { ...story, status: "backlog", sprint_id: null },
      error: null,
    }),
  }));
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("POST /api/stories/:storyId/reject — zavračanje zgodbe (#26)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — product owner uspešno zavrne zgodbo brez komentarja", async () => {
    setupMocks();
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/zavrnjena/i);
  });

  it("200 — product owner uspešno zavrne zgodbo s komentarjem", async () => {
    setupMocks();
    const res = await REJECT(
      makeRejectRequest({ comment: "Acceptance criteria not met." }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/zavrnjena/i);
  });

  it("400 — že potrjene zgodbe ni mogoče zavrniti (status done)", async () => {
    setupMocks({ story: doneStory });
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/potrjene/i);
  });

  it("400 — zgodba je že v backlogu", async () => {
    setupMocks({ story: backlogStory });
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/backlog/i);
  });

  it("400 — zgodba ni v aktivnem sprintu", async () => {
    setupMocks({ sprint: inactiveSprint });
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/aktivnem sprintu/i);
  });

  it("403 — scrum master ne more zavračati zgodb", async () => {
    setupMocks({ membership: { role: "scrum_master" } });
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/product owner/i);
  });

  it("403 — developer ne more zavračati zgodb", async () => {
    setupMocks({ membership: { role: "developer" } });
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("404 — zgodba ne obstaja", async () => {
    setupMocks({ story: null });
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ne obstaja/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await REJECT(makeRejectRequest(), makeContext());
    expect(res.status).toBe(401);
  });
});
