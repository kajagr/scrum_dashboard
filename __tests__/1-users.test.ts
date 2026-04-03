import { POST } from "@/app/api/users/route";

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminFrom = jest.fn<any, any>();
const mockAdminCreateUser = jest.fn();
const mockAdminDeleteUser = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
    auth: {
      admin: {
        createUser: (...args: any[]) => mockAdminCreateUser(...args),
        deleteUser: (...args: any[]) => mockAdminDeleteUser(...args),
      },
    },
  })),
}));

// ─── Mock createServerClient ──────────────────────────────────────────────────
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
  ),
}));

// ─── Helper: thenable read chain ─────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

function makeRequest(body: object) {
  return new Request("http://localhost/api/users", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  email: "test@example.com",
  password: "geslo12345678",
  username: "testuser",
  first_name: "Jane",
  last_name: "Doe",
  system_role: "user",
};

// ─── Setup mocks ──────────────────────────────────────────────────────────────
// POST flow:
//   cnt=1: admin check      — .select("system_role").eq().single()
//   cnt=2: username check   — .select("id").ilike().maybeSingle()
//   cnt=3: all emails fetch — .select("email")  [thenable]
//   cnt=4: insert profile   — .insert()
function setupPostMocks(
  overrides: {
    isAdmin?: boolean;
    duplicateUsername?: boolean;
    existingEmails?: string[];
    insertError?: any;
  } = {},
) {
  const {
    isAdmin = true,
    duplicateUsername = false,
    existingEmails = [],
    insertError = null,
  } = overrides;

  let cnt = 0;
  mockAdminFrom.mockImplementation(() => {
    cnt++;

    // 1. Admin check
    if (cnt === 1)
      return makeReadChain({
        data: { system_role: isAdmin ? "admin" : "user" },
        error: null,
      });

    // 2. Username duplicate check
    if (cnt === 2)
      return makeReadChain({
        data: duplicateUsername ? { id: "existing" } : null,
        error: null,
      });

    // 3. All emails fetch (za normalizirano email primerjavo)
    if (cnt === 3)
      return makeReadChain({
        data: existingEmails.map((email) => ({ email })),
        error: null,
      });

    // 4. Insert profile
    return {
      insert: jest.fn().mockResolvedValue({ error: insertError }),
    };
  });

  mockAdminCreateUser.mockResolvedValue({
    data: { user: { id: "new-user-1" } },
    error: null,
  });
  mockAdminDeleteUser.mockResolvedValue({ error: null });
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("POST /api/users — adding users (#1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
  });

  it("201 — successfully creates new user with all data", async () => {
    setupPostMocks();
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toMatch(/user created successfully/i);
    expect(body.user.email).toBe("test@example.com");
    expect(body.user.username).toBe("testuser");
  });

  it("201 — creates user with role 'user' (default)", async () => {
    setupPostMocks();
    const res = await POST(makeRequest({ ...validBody, system_role: "user" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.system_role).toBe("user");
  });

  it("201 — admin can create another admin", async () => {
    setupPostMocks();
    const res = await POST(makeRequest({ ...validBody, system_role: "admin" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.system_role).toBe("admin");
  });

  it("409 — rejects user with existing username", async () => {
    setupPostMocks({ duplicateUsername: true });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/username already exists/i);
  });

  it("409 — rejects user with existing email (exact match)", async () => {
    setupPostMocks({ existingEmails: ["test@example.com"] });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/email already exists/i);
  });

  it("409 — rejects user with normalized duplicate email (pike)", async () => {
    // t.e.s.t@example.com normalizira v test@example.com — enako kot test@example.com
    setupPostMocks({ existingEmails: ["t.e.s.t@example.com"] });
    const res = await POST(
      makeRequest({ ...validBody, email: "test@example.com" }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/email already exists/i);
  });

  it("403 — non-admin user cannot create a new user", async () => {
    setupPostMocks({ isAdmin: false });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/only administrators can create users/i);
  });

  it("401 — unauthenticated user cannot create a user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("400 — missing required fields (email, password, username)", async () => {
    setupPostMocks();
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email, password and username are required/i);
  });

  it("400 — password is too short (< 12 characters)", async () => {
    setupPostMocks();
    const res = await POST(makeRequest({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 12 characters/i);
  });

  it("400 — password is too long (> 64 characters)", async () => {
    setupPostMocks();
    const res = await POST(
      makeRequest({ ...validBody, password: "a".repeat(65) }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/longer than 64 characters/i);
  });

  it("500 — deletes auth user if profile insert fails", async () => {
    setupPostMocks({ insertError: { message: "DB constraint violation" } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error creating user profile/i);
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("new-user-1");
  });
});
