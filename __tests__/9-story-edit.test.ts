import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/stories/[storyId]/route";

// ─── Mock Supabase ────────────────────────────────────────────────────────────
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

// ─── Helper funkcije ──────────────────────────────────────────────────────────
function makePatchRequest(body: object) {
  return new NextRequest("http://localhost/api/stories/story-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/stories/story-1", {
    method: "DELETE",
  });
}

function makeContext(storyId = "story-1") {
  return { params: Promise.resolve({ storyId }) };
}

// ─── Default podatki ──────────────────────────────────────────────────────────
const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  title: "Obstoječa zgodba",
  status: "backlog",
  sprint_id: null,
};

const defaultMembership = { role: "product_owner" };

const validBody = {
  title: "Posodobljena zgodba",
  description: "Opis",
  acceptance_criteria: "Kriteriji",
  priority: "must_have",
  business_value: 50,
  story_points: 5,
};

// ─── Setup mock ───────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    story?: any;
    membership?: any;
    duplicate?: any;
    updateResult?: any;
  } = {},
) {
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const duplicate = overrides.duplicate ?? null;
  const updateResult = overrides.updateResult ?? {
    data: { id: "story-1" },
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return {
        // user_stories — pridobi zgodbo
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 2)
      return {
        // project_members — preveri članstvo
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };
    if (cnt === 3)
      return {
        // user_stories — preveri duplikat
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: duplicate, error: null }),
      };
    return {
      // user_stories — update
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(updateResult),
    };
  });
}

function setupDeleteMocks(
  overrides: {
    story?: any;
    membership?: any;
  } = {},
) {
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 2)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };
    return {
      // delete
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue({ error: null }),
    };
  });
}

// ─── TESTI ZA PATCH ───────────────────────────────────────────────────────────
describe("PATCH /api/stories/:storyId — urejanje zgodbe (#9)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ──────────────────────────────────────────────────
  it("200 — uspešno uredi zgodbo", async () => {
    setupMocks();

    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(200);
  });

  // ─── #2: Zgodba dodeljena sprintu ─────────────────────────────────────────
  it("400 — zgodba je dodeljena sprintu", async () => {
    setupMocks({ story: { ...defaultStory, sprint_id: "sprint-1" } });

    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprintu/i);
  });

  // ─── #3: Zgodba je realizirana ────────────────────────────────────────────
  it("400 — zgodba je realizirana", async () => {
    setupMocks({ story: { ...defaultStory, status: "done" } });

    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/realiziran/i);
  });

  // ─── #4: Podvajanje naslova ───────────────────────────────────────────────
  it("409 — podvajanje naslova zgodbe", async () => {
    setupMocks({ duplicate: { id: "story-2" } });

    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/naslov/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("403 — developer nima pravic za urejanje", async () => {
    setupMocks({ membership: { role: "developer" } });

    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(403);
  });

  it("403 — uporabnik ni član projekta", async () => {
    setupMocks({ membership: null });

    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(403);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(401);
  });

  it("400 — manjkajoča obvezna polja", async () => {
    setupMocks();

    const res = await PATCH(makePatchRequest({ title: "Test" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("400 — neveljavna prioriteta", async () => {
    setupMocks();

    const res = await PATCH(
      makePatchRequest({ ...validBody, priority: "invalid" }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});

// ─── TESTI ZA DELETE ──────────────────────────────────────────────────────────
describe("DELETE /api/stories/:storyId — brisanje zgodbe (#9)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ──────────────────────────────────────────────────
  it("200 — uspešno izbriše zgodbo", async () => {
    setupDeleteMocks();

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/izbrisana/i);
  });

  // ─── #2: Zgodba dodeljena sprintu ─────────────────────────────────────────
  it("400 — zgodba je dodeljena sprintu", async () => {
    setupDeleteMocks({ story: { ...defaultStory, sprint_id: "sprint-1" } });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprintu/i);
  });

  // ─── #3: Zgodba je realizirana ────────────────────────────────────────────
  it("400 — zgodba je realizirana", async () => {
    setupDeleteMocks({ story: { ...defaultStory, status: "done" } });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/realiziran/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("403 — developer nima pravic za brisanje", async () => {
    setupDeleteMocks({ membership: { role: "developer" } });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(401);
  });
});
