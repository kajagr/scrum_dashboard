import { NextRequest } from "next/server";
import {
  GET,
  POST,
} from "@/app/api/projects/[projectId]/wall/[postId]/comments/route";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeGetRequest() {
  return new NextRequest("http://localhost/api/wall/post-1/comments", {
    method: "GET",
  });
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/wall/post-1/comments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(postId = "post-1") {
  return { params: Promise.resolve({ postId }) };
}

// ─── Shared mock builders ─────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Default data ─────────────────────────────────────────────────────────────
const defaultPost = { id: "post-1", project_id: "project-1" };
const defaultMembership = { role: "developer" };

const defaultComments = [
  {
    id: "comment-1",
    content: "Odlično delo!",
    created_at: "2024-01-15T11:00:00Z",
    author: { id: "user-1", first_name: "Jana", last_name: "Novak" },
  },
  {
    id: "comment-2",
    content: "Strinjam se.",
    created_at: "2024-01-15T12:00:00Z",
    author: { id: "user-2", first_name: "Mitja", last_name: "Koruza" },
  },
];

const defaultInsertedComment = {
  id: "comment-3",
  content: "Nov komentar!",
  created_at: "2024-01-16T10:00:00Z",
  author: { id: "user-1", first_name: "Jana", last_name: "Novak" },
};

// ─── Setup mocks ──────────────────────────────────────────────────────────────
// Route order: 1) post fetch, 2) membership check, 3) comments fetch/insert
function setupGetMocks(
  overrides: {
    post?: any;
    membership?: any;
    comments?: any;
    commentsError?: any;
  } = {},
) {
  const post = overrides.post !== undefined ? overrides.post : defaultPost;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const comments =
    overrides.comments !== undefined ? overrides.comments : defaultComments;
  const commentsError = overrides.commentsError ?? null;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: post, error: null }); // project_wall_posts
    if (cnt === 2) return makeReadChain({ data: membership, error: null }); // project_members
    // post_comments — fetch
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest
        .fn()
        .mockResolvedValue({ data: comments, error: commentsError }),
    };
  });
}

function setupPostMocks(
  overrides: {
    post?: any;
    membership?: any;
    insertResult?: { data: any; error: any };
  } = {},
) {
  const post = overrides.post !== undefined ? overrides.post : defaultPost;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const insertResult = overrides.insertResult ?? {
    data: defaultInsertedComment,
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: post, error: null }); // project_wall_posts
    if (cnt === 2) return makeReadChain({ data: membership, error: null }); // project_members
    // post_comments — insert
    return {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(insertResult),
    };
  });
}

// ─── GET TESTS ────────────────────────────────────────────────────────────────
describe("GET /api/wall/:postId/comments — prikaz komentarjev (#23)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ─────────────────────────────────────────────────
  it("200 — vrne seznam komentarjev z avtorjem", async () => {
    setupGetMocks();

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("comment-1");
    expect(body[0].author.first_name).toBe("Jana");
    expect(body[0].content).toBe("Odlično delo!");
  });

  it("200 — vrne prazen seznam če ni komentarjev", async () => {
    setupGetMocks({ comments: [] });

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  // ─── #2: Objava ne obstaja ────────────────────────────────────────────────
  it("404 — objava ne obstaja", async () => {
    setupGetMocks({ post: null });

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  // ─── #3: Pravice ─────────────────────────────────────────────────────────
  it("403 — ne-član projekta ne more videti komentarjev", async () => {
    setupGetMocks({ membership: null });

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  // ─── #4: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── POST TESTS ───────────────────────────────────────────────────────────────
describe("POST /api/wall/:postId/comments — dodajanje komentarja (#23)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ─────────────────────────────────────────────────
  it("201 — uspešno doda komentar", async () => {
    setupPostMocks();

    const res = await POST(
      makePostRequest({ content: "Nov komentar!" }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("comment-3");
    expect(body.content).toBe("Nov komentar!");
    expect(body.author.first_name).toBe("Jana");
  });

  // ─── #2: Prazen content ───────────────────────────────────────────────────
  it("400 — zavrne prazen komentar", async () => {
    setupPostMocks();

    const res = await POST(makePostRequest({ content: "" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be empty/i);
  });

  it("400 — zavrne komentar samo s presledki", async () => {
    setupPostMocks();

    const res = await POST(makePostRequest({ content: "   " }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be empty/i);
  });

  it("400 — zavrne manjkajoče polje content", async () => {
    setupPostMocks();

    const res = await POST(makePostRequest({}), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be empty/i);
  });

  // ─── #3: Objava ne obstaja ────────────────────────────────────────────────
  it("404 — objava ne obstaja", async () => {
    setupPostMocks({ post: null });

    const res = await POST(
      makePostRequest({ content: "Komentar" }),
      makeContext(),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  // ─── #4: Pravice ─────────────────────────────────────────────────────────
  it("403 — ne-član projekta ne more komentirati", async () => {
    setupPostMocks({ membership: null });

    const res = await POST(
      makePostRequest({ content: "Komentar" }),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  // ─── #5: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(
      makePostRequest({ content: "Komentar" }),
      makeContext(),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});
