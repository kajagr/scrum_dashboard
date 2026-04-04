import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/stories/[storyId]/comments/route";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(resolvedValue),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    insert: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

function makeContext(storyId = "story-1") {
  return { params: Promise.resolve({ storyId }) };
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/stories/story-1/comments", {
    method: "GET",
  });
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/stories/story-1/comments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const sampleComment = {
  id: "comment-1",
  content: "Test comment",
  created_at: "2024-01-01T00:00:00Z",
  author: {
    id: "user-1",
    first_name: "Janez",
    last_name: "Novak",
    username: "janez",
  },
};

// ─── Setup helpers ────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    story?: any;
    membership?: any;
    comments?: any[];
  } = {},
) {
  const story =
    overrides.story !== undefined
      ? overrides.story
      : { id: "story-1", project_id: "project-1" };
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : { role: "developer" };
  const comments = overrides.comments ?? [sampleComment];

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      // user_stories — story check
      return makeReadChain({ data: story, error: null });
    if (cnt === 2)
      // project_members — membership check
      return makeReadChain({ data: membership, error: null });
    // story_comments — GET list
    return makeReadChain({ data: comments, error: null });
  });
}

function setupPostMocks(
  overrides: {
    story?: any;
    membership?: any;
    insertResult?: any;
  } = {},
) {
  const story =
    overrides.story !== undefined
      ? overrides.story
      : { id: "story-1", project_id: "project-1" };
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : { role: "developer" };
  const insertResult = overrides.insertResult ?? {
    data: sampleComment,
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: story, error: null });
    if (cnt === 2) return makeReadChain({ data: membership, error: null });
    // story_comments — insert
    return {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(insertResult),
    };
  });
}

// ─── GET /api/stories/:storyId/comments ───────────────────────────────────────
describe("GET /api/stories/:storyId/comments — prikaz opomb (#10)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — član dobi seznam opomb z avtorjem", async () => {
    setupMocks();
    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].content).toBe("Test comment");
    expect(body[0].author).toBeDefined();
  });

  it("200 — vrne prazen seznam če ni opomb", async () => {
    setupMocks({ comments: [] });
    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it("403 — ne-član ne more videti opomb", async () => {
    setupMocks({ membership: null });
    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("404 — zgodba ne obstaja", async () => {
    setupMocks({ story: null });
    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── POST /api/stories/:storyId/comments ──────────────────────────────────────
describe("POST /api/stories/:storyId/comments — dodajanje opombe (#10)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("201 — član uspešno doda opombo", async () => {
    setupPostMocks();
    const res = await POST(
      makePostRequest({ content: "Test comment" }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.content).toBe("Test comment");
    expect(body.author).toBeDefined();
  });

  it("400 — prazen content je zavrnjen", async () => {
    setupPostMocks();
    const res = await POST(makePostRequest({ content: "" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
  });

  it("400 — content samo s presledki je zavrnjen", async () => {
    setupPostMocks();
    const res = await POST(makePostRequest({ content: "   " }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
  });

  it("403 — ne-član ne more dodati opombe", async () => {
    setupPostMocks({ membership: null });
    const res = await POST(makePostRequest({ content: "Test" }), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("404 — zgodba ne obstaja", async () => {
    setupPostMocks({ story: null });
    const res = await POST(makePostRequest({ content: "Test" }), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(makePostRequest({ content: "Test" }), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});
