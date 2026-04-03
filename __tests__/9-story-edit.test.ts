import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/stories/[storyId]/route";

// ─── Mock Supabase (server client) ───────────────────────────────────────────
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

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

// ─── Helper functions ─────────────────────────────────────────────────────────
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

// ─── Default data ─────────────────────────────────────────────────────────────
const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  title: "Existing story",
  status: "backlog",
  sprint_id: null,
  story_points: 5,
};

const defaultMembership = { role: "product_owner" };

const validBody = {
  title: "Updated story",
  description: "Description",
  acceptance_criteria: "Criteria",
  priority: "must_have",
  business_value: 8,
  story_points: 5,
};

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    story?: any;
    membership?: any;
    duplicate?: any;
    updateResult?: any;
    activeSprint?: boolean;
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
  const activeSprint = overrides.activeSprint ?? false;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  let cnt = 0;
  mockFrom.mockImplementation((table: string) => {
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
    // sprints query — samo ko ima story sprint_id
    if (table === "sprints")
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: activeSprint
            ? { start_date: yesterday, end_date: tomorrow }
            : null,
          error: null,
        }),
      };
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      maybeSingle: jest
        .fn()
        .mockResolvedValue({ data: duplicate, error: null }),
    };
  });

  mockAdminFrom.mockImplementation(() => ({
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(updateResult),
  }));
}

function setupDeleteMocks(
  overrides: {
    story?: any;
    membership?: any;
    activeSprint?: boolean;
  } = {},
) {
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const activeSprint = overrides.activeSprint ?? false;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  let cnt = 0;
  mockFrom.mockImplementation((table: string) => {
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
    if (table === "sprints")
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: activeSprint
            ? { start_date: yesterday, end_date: tomorrow }
            : null,
          error: null,
        }),
      };
    return {};
  });

  mockAdminFrom.mockImplementation(() => ({
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  }));
}

// ─── PATCH TESTS ──────────────────────────────────────────────────────────────
describe("PATCH /api/stories/:storyId — edit story (#9)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — successfully edits a story", async () => {
    setupMocks();
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(200);
  });

  it("400 — story is assigned to an active sprint", async () => {
    setupMocks({
      story: { ...defaultStory, sprint_id: "sprint-1" },
      activeSprint: true,
    });
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprint/i);
  });

  it("200 — story has sprint_id but sprint is not active (past sprint)", async () => {
    setupMocks({
      story: { ...defaultStory, sprint_id: "sprint-1" },
      activeSprint: false,
    });
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(200);
  });

  it("400 — story is completed", async () => {
    setupMocks({ story: { ...defaultStory, status: "done" } });
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/completed/i);
  });

  it("409 — duplicate story title", async () => {
    setupMocks({ duplicate: { id: "story-2" } });
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it("403 — developer does not have permission to edit", async () => {
    setupMocks({ membership: { role: "developer" } });
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("403 — user is not a project member", async () => {
    setupMocks({ membership: null });
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PATCH(makePatchRequest(validBody), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("400 — missing required fields", async () => {
    setupMocks();
    const res = await PATCH(makePatchRequest({ title: "Test" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("400 — invalid priority value", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ ...validBody, priority: "invalid" }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid priority/i);
  });

  it("400 — business value out of range", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ ...validBody, business_value: 200 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/business value/i);
  });

  it("400 — negative story points", async () => {
    setupMocks();
    const res = await PATCH(
      makePatchRequest({ ...validBody, story_points: -1 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/story points/i);
  });
});

// ─── DELETE TESTS ─────────────────────────────────────────────────────────────
describe("DELETE /api/stories/:storyId — delete story (#9)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — successfully deletes a story", async () => {
    setupDeleteMocks();
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/deleted successfully/i);
  });

  it("400 — story is assigned to an active sprint", async () => {
    setupDeleteMocks({
      story: { ...defaultStory, sprint_id: "sprint-1" },
      activeSprint: true,
    });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprint/i);
  });

  it("200 — story has sprint_id but sprint is not active", async () => {
    setupDeleteMocks({
      story: { ...defaultStory, sprint_id: "sprint-1" },
      activeSprint: false,
    });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(200);
  });

  it("400 — story is completed", async () => {
    setupDeleteMocks({ story: { ...defaultStory, status: "done" } });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/completed/i);
  });

  it("403 — developer does not have permission to delete", async () => {
    setupDeleteMocks({ membership: { role: "developer" } });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("404 — story not found", async () => {
    setupDeleteMocks({ story: null });
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
