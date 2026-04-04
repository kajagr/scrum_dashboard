import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/stories/[storyId]/estimate/route";

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

function makePatchRequest(body: object) {
  return new NextRequest("http://localhost/api/stories/story-1/estimate", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  sprint_id: null,
  status: "backlog",
};

const updatedStory = { ...defaultStory, story_points: 5 };

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    story?: any;
    membership?: any;
    updateResult?: any;
  } = {},
) {
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : { role: "scrum_master" };
  const updateResult = overrides.updateResult ?? {
    data: updatedStory,
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      // user_stories — story check
      return makeReadChain({ data: story, error: null });
    // project_members — membership check
    return makeReadChain({ data: membership, error: null });
  });

  mockAdminFrom.mockImplementation(() => ({
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(updateResult),
  }));
}

// ─── PATCH /api/stories/:storyId/estimate ────────────────────────────────────
describe("PATCH /api/stories/:storyId/estimate — ocena časovne zahtevnosti (#11)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── Regularen potek ──────────────────────────────────────────────────────
  it("200 — scrum master uspešno nastavi oceno", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ story_points: 5 }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.story_points).toBe(5);
  });

  it("200 — scrum master uspešno spremeni obstoječo oceno", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ story_points: 13 }),
      makeContext(),
    );
    expect(res.status).toBe(200);
  });

  // ─── Veljavnost ocene ─────────────────────────────────────────────────────
  it("400 — ocena 0 ni veljavna", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ story_points: 0 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/positive number/i);
  });

  it("400 — negativna ocena ni veljavna", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ story_points: -3 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/positive number/i);
  });

  it("400 — NaN ni veljavna ocena", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ story_points: "abc" }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/positive number/i);
  });

  // ─── Zgodba v sprintu ─────────────────────────────────────────────────────
  it("400 — zgodbe ki je že dodeljena sprintu ne moremo oceniti", async () => {
    setupMocks({ story: { ...defaultStory, sprint_id: "sprint-1" } });
    const res = await PATCH(
      makePatchRequest({ story_points: 5 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprint/i);
  });

  // ─── Pravice ──────────────────────────────────────────────────────────────
  it("403 — product owner ne more oceniti zgodbe", async () => {
    setupMocks({ membership: { role: "product_owner" } });
    const res = await PATCH(
      makePatchRequest({ story_points: 5 }),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("403 — developer ne more oceniti zgodbe", async () => {
    setupMocks({ membership: { role: "developer" } });
    const res = await PATCH(
      makePatchRequest({ story_points: 5 }),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("403 — ne-član ne more oceniti zgodbe", async () => {
    setupMocks({ membership: null });
    const res = await PATCH(
      makePatchRequest({ story_points: 5 }),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  // ─── Avtentikacija ────────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PATCH(
      makePatchRequest({ story_points: 5 }),
      makeContext(),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ─── Zgodba ne obstaja ────────────────────────────────────────────────────
  it("404 — zgodba ne obstaja", async () => {
    setupMocks({ story: null });
    const res = await PATCH(
      makePatchRequest({ story_points: 5 }),
      makeContext(),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
