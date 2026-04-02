import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/projects/[projectId]/wall/route";

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
  return new NextRequest("http://localhost/api/projects/project-1/wall", {
    method: "GET",
  });
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/projects/project-1/wall", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
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
const defaultMembership = { role: "developer" };

const defaultPosts = [
  {
    id: "post-1",
    content: "Danes smo zaključili Sprint 1!",
    created_at: "2024-01-15T10:30:00Z",
    author: { id: "user-1", first_name: "Jana", last_name: "Novak" },
    post_comments: [{ count: 3 }],
  },
  {
    id: "post-2",
    content: "Nova objava na zidu.",
    created_at: "2024-01-14T09:00:00Z",
    author: { id: "user-2", first_name: "Mitja", last_name: "Koruza" },
    post_comments: [{ count: 0 }],
  },
];

const defaultInsertedPost = {
  id: "post-3",
  content: "Nova objava!",
  created_at: "2024-01-16T12:00:00Z",
  author: { id: "user-1", first_name: "Jana", last_name: "Novak" },
};

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupGetMocks(
  overrides: {
    membership?: any;
    posts?: any;
    postsError?: any;
  } = {},
) {
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const posts = overrides.posts !== undefined ? overrides.posts : defaultPosts;
  const postsError = overrides.postsError ?? null;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      // project_members — membership check
      return makeReadChain({ data: membership, error: null });
    // project_wall_posts — fetch posts
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: posts, error: postsError }),
    };
  });
}

function setupPostMocks(
  overrides: {
    membership?: any;
    insertResult?: { data: any; error: any };
  } = {},
) {
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const insertResult = overrides.insertResult ?? {
    data: defaultInsertedPost,
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      // project_members — membership check
      return makeReadChain({ data: membership, error: null });
    // project_wall_posts — insert
    return {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(insertResult),
    };
  });
}

// ─── GET TESTS ────────────────────────────────────────────────────────────────
describe("GET /api/projects/:projectId/wall — prikaz objav (#22)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ─────────────────────────────────────────────────
  it("200 — vrne seznam objav z avtorjem in comment_count", async () => {
    setupGetMocks();

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("post-1");
    expect(body[0].author.first_name).toBe("Jana");
    expect(body[0].comment_count).toBe(3);
    expect(body[0].post_comments).toBeUndefined(); // skrito
  });

  it("200 — vrne prazen seznam če ni objav", async () => {
    setupGetMocks({ posts: [] });

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  // ─── #2: Pravice ─────────────────────────────────────────────────────────
  it("403 — ne-član projekta ne more videti objav", async () => {
    setupGetMocks({ membership: null });

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  // ─── #3: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(makeGetRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── POST TESTS ───────────────────────────────────────────────────────────────
describe("POST /api/projects/:projectId/wall — dodajanje objave (#22)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ─────────────────────────────────────────────────
  it("201 — uspešno doda novo objavo", async () => {
    setupPostMocks();

    const res = await POST(
      makePostRequest({ content: "Nova objava!" }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("post-3");
    expect(body.content).toBe("Nova objava!");
    expect(body.author.first_name).toBe("Jana");
    expect(body.comment_count).toBe(0);
  });

  // ─── #2: Prazen content ───────────────────────────────────────────────────
  it("400 — zavrne prazno vsebino", async () => {
    setupPostMocks();

    const res = await POST(makePostRequest({ content: "" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be empty/i);
  });

  it("400 — zavrne vsebino samo s presledki", async () => {
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

  // ─── #3: Pravice ─────────────────────────────────────────────────────────
  it("403 — ne-član projekta ne more objavljati", async () => {
    setupPostMocks({ membership: null });

    const res = await POST(
      makePostRequest({ content: "Objava" }),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  // ─── #4: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(
      makePostRequest({ content: "Objava" }),
      makeContext(),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});
