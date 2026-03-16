import { POST } from "@/app/api/users/route";

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminSingle = jest.fn();
const mockAdminMaybeSingle = jest.fn();
const mockAdminCreateUser = jest.fn();
const mockAdminDeleteUser = jest.fn();
const mockAdminFrom = jest.fn<any, any>();

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

// ─── Helper ───────────────────────────────────────────────────────────────────
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
  first_name: "Janez",
  last_name: "Novak",
  system_role: "user",
};

// ─── Setup default mocks ──────────────────────────────────────────────────────
function setupDefaultMocks() {
  // Admin user check
  mockAdminSingle.mockResolvedValue({
    data: { system_role: "admin" },
    error: null,
  });

  // Username and email do not exist
  mockAdminMaybeSingle.mockResolvedValue({ data: null, error: null });

  // Auth user successfully created
  mockAdminCreateUser.mockResolvedValue({
    data: { user: { id: "new-user-1" } },
    error: null,
  });

  // Default from mock
  mockAdminFrom.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnValue({ maybeSingle: mockAdminMaybeSingle }),
    insert: jest.fn().mockResolvedValue({ error: null }),
    single: mockAdminSingle,
  }));
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("POST /api/users — adding users (#1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    setupDefaultMocks();
  });

  // ─── #1: Successful user creation ──────────────────────────────────────────
  it("201 — successfully creates new user with all data", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    // Changed from matching Slovene "uspešno" to English message
    expect(body.message).toMatch(/success/i);
    expect(body.user.email).toBe("test@example.com");
    expect(body.user.username).toBe("testuser");
  });

  it("201 — creates user with role 'user' (default)", async () => {
    const res = await POST(makeRequest({ ...validBody, system_role: "user" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.system_role).toBe("user");
  });

  // ─── #2: Duplicate username ────────────────────────────────────────────────
  it("409 — rejects user with existing username", async () => {
    let ilikeCall = 0;
    mockAdminFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockImplementation(() => {
          ilikeCall++;
          // First call = username check → exists
          if (ilikeCall === 1)
            return Promise.resolve({ data: { id: "existing" }, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      single: mockAdminSingle,
    }));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    // English error check
    expect(body.error.toLowerCase()).toMatch(/username/i);
  });

  // ─── #3: System permissions ────────────────────────────────────────────────
  it("403 — normal user cannot create a new user", async () => {
    mockAdminSingle.mockResolvedValue({
      data: { system_role: "user" },
      error: null,
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    // English error: should match "Only administrators can" or "administrator"
    expect(
      body.error.toLowerCase()
    ).toMatch(/administrat(or|ors)/i);
  });

  it("201 — admin can create another admin", async () => {
    const res = await POST(makeRequest({ ...validBody, system_role: "admin" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.system_role).toBe("admin");
  });

  // ─── Additional tests ──────────────────────────────────────────────────────
  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("400 — missing required fields", async () => {
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    // Changed error text check from "obvezni" (required) to "required"
    expect(body.error.toLowerCase()).toMatch(/required/i);
  });

  it("400 — password is too short (< 12 characters)", async () => {
    const res = await POST(makeRequest({ ...validBody, password: "kratek" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    // Error should mention "12"
    expect(body.error).toMatch(/12/);
  });

  it("400 — password is too long (> 64 characters)", async () => {
    const res = await POST(
      makeRequest({ ...validBody, password: "a".repeat(65) }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    // Error should mention "64"
    expect(body.error).toMatch(/64/);
  });

  it("409 — rejects user with existing email", async () => {
    let ilikeCall = 0;
    mockAdminFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockImplementation(() => {
          ilikeCall++;
          // First call = username → ok, second call = email → exists
          if (ilikeCall === 2)
            return Promise.resolve({ data: { id: "existing" }, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      single: mockAdminSingle,
    }));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    // Changed error text check from "e-pošta" (email) to "email"
    expect(body.error.toLowerCase()).toMatch(/email/i);
  });
});
