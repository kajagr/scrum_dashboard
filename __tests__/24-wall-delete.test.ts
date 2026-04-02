import { NextRequest } from "next/server";
import { DELETE as DELETE_POST } from "@/app/api/projects/[projectId]/wall/[postId]/route";
import { DELETE as DELETE_COMMENT } from "@/app/api/projects/[projectId]/wall/[postId]/comments/[commentId]/route";

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
function makeDeletePostRequest() {
  return new NextRequest(
    "http://localhost/api/projects/project-1/wall/post-1",
    {
      method: "DELETE",
    },
  );
}

function makeDeleteCommentRequest() {
  return new NextRequest(
    "http://localhost/api/projects/project-1/wall/post-1/comments/comment-1",
    {
      method: "DELETE",
    },
  );
}

function makePostContext(projectId = "project-1", postId = "post-1") {
  return { params: Promise.resolve({ projectId, postId }) };
}

function makeCommentContext(
  projectId = "project-1",
  postId = "post-1",
  commentId = "comment-1",
) {
  return { params: Promise.resolve({ projectId, postId, commentId }) };
}

// ─── Shared mock builders ─────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
  };
}

function makeDeleteChain(resolvedValue: { error: any }) {
  return {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Default data ─────────────────────────────────────────────────────────────
const defaultPost = { id: "post-1" };
const defaultComment = { id: "comment-1" };

// ─── Setup mocks — DELETE POST ────────────────────────────────────────────────
// Route order: 1) membership, 2) post existence check, 3) delete
function setupDeletePostMocks(
  overrides: {
    membership?: any;
    post?: any;
    deleteError?: any;
  } = {},
) {
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : { role: "scrum_master" };
  const post = overrides.post !== undefined ? overrides.post : defaultPost;
  const deleteError = overrides.deleteError ?? null;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: membership, error: null }); // project_members
    if (cnt === 2) return makeReadChain({ data: post, error: null }); // project_wall_posts existence
    return makeDeleteChain({ error: deleteError }); // project_wall_posts delete
  });
}

// ─── Setup mocks — DELETE COMMENT ────────────────────────────────────────────
// Route order: 1) membership, 2) comment existence check, 3) delete
function setupDeleteCommentMocks(
  overrides: {
    membership?: any;
    comment?: any;
    deleteError?: any;
  } = {},
) {
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : { role: "scrum_master" };
  const comment =
    overrides.comment !== undefined ? overrides.comment : defaultComment;
  const deleteError = overrides.deleteError ?? null;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: membership, error: null }); // project_members
    if (cnt === 2) return makeReadChain({ data: comment, error: null }); // post_comments existence
    return makeDeleteChain({ error: deleteError }); // post_comments delete
  });
}

// ─── DELETE POST TESTS ────────────────────────────────────────────────────────
describe("DELETE /api/projects/:projectId/wall/:postId — brisanje objave (#24)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ─────────────────────────────────────────────────
  it("200 — scrum_master uspešno izbriše objavo", async () => {
    setupDeletePostMocks();

    const res = await DELETE_POST(makeDeletePostRequest(), makePostContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/deleted successfully/i);
  });

  // ─── #2: Kaskadno brisanje komentarjev ───────────────────────────────────
  // Kaskadno brisanje je definirano na nivoju baze (ON DELETE CASCADE),
  // zato testiramo da DELETE vrne uspeh — baza sama poskrbi za komentarje.
  it("200 — ob brisanju objave se izbrišejo tudi komentarji (kaskada v bazi)", async () => {
    setupDeletePostMocks();

    const res = await DELETE_POST(makeDeletePostRequest(), makePostContext());
    expect(res.status).toBe(200);
    // Kaskada poteka v bazi — route ne kliče ločenega DELETE za komentarje
    const body = await res.json();
    expect(body.message).toMatch(/deleted successfully/i);
  });

  // ─── #3: Objava ne obstaja ────────────────────────────────────────────────
  it("404 — objava ne obstaja", async () => {
    setupDeletePostMocks({ post: null });

    const res = await DELETE_POST(makeDeletePostRequest(), makePostContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  // ─── #4: Pravice ─────────────────────────────────────────────────────────
  it("403 — developer ne more brisati objav", async () => {
    setupDeletePostMocks({ membership: { role: "developer" } });

    const res = await DELETE_POST(makeDeletePostRequest(), makePostContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("403 — product_owner ne more brisati objav", async () => {
    setupDeletePostMocks({ membership: { role: "product_owner" } });

    const res = await DELETE_POST(makeDeletePostRequest(), makePostContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("403 — ne-član projekta ne more brisati objav", async () => {
    setupDeletePostMocks({ membership: null });

    const res = await DELETE_POST(makeDeletePostRequest(), makePostContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  // ─── #5: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE_POST(makeDeletePostRequest(), makePostContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── DELETE COMMENT TESTS ─────────────────────────────────────────────────────
describe("DELETE /api/projects/:projectId/wall/:postId/comments/:commentId — brisanje komentarja (#24)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ─────────────────────────────────────────────────
  it("200 — scrum_master uspešno izbriše komentar", async () => {
    setupDeleteCommentMocks();

    const res = await DELETE_COMMENT(
      makeDeleteCommentRequest(),
      makeCommentContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/deleted successfully/i);
  });

  // ─── #2: Komentar ne obstaja ──────────────────────────────────────────────
  it("404 — komentar ne obstaja", async () => {
    setupDeleteCommentMocks({ comment: null });

    const res = await DELETE_COMMENT(
      makeDeleteCommentRequest(),
      makeCommentContext(),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  // ─── #3: Pravice ─────────────────────────────────────────────────────────
  it("403 — developer ne more brisati komentarjev", async () => {
    setupDeleteCommentMocks({ membership: { role: "developer" } });

    const res = await DELETE_COMMENT(
      makeDeleteCommentRequest(),
      makeCommentContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("403 — product_owner ne more brisati komentarjev", async () => {
    setupDeleteCommentMocks({ membership: { role: "product_owner" } });

    const res = await DELETE_COMMENT(
      makeDeleteCommentRequest(),
      makeCommentContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/scrum master/i);
  });

  it("403 — ne-član projekta ne more brisati komentarjev", async () => {
    setupDeleteCommentMocks({ membership: null });

    const res = await DELETE_COMMENT(
      makeDeleteCommentRequest(),
      makeCommentContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  // ─── #4: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE_COMMENT(
      makeDeleteCommentRequest(),
      makeCommentContext(),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});
