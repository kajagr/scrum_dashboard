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

// ─── Setup default mockov ─────────────────────────────────────────────────────
function setupDefaultMocks() {
  // Admin user check
  mockAdminSingle.mockResolvedValue({
    data: { system_role: "admin" },
    error: null,
  });

  // Username in email ne obstajata
  mockAdminMaybeSingle.mockResolvedValue({ data: null, error: null });

  // Auth user uspešno ustvarjen
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

// ─── TESTI ────────────────────────────────────────────────────────────────────
describe("POST /api/users — dodajanje uporabnikov (#1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    setupDefaultMocks();
  });

  // ─── #1: Uspešno dodajanje uporabnika ────────────────────────────────────
  it("201 — uspešno ustvari novega uporabnika s vsemi podatki", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toMatch(/uspešno/i);
    expect(body.user.email).toBe("test@example.com");
    expect(body.user.username).toBe("testuser");
  });

  it("201 — ustvari uporabnika z vlogo 'user' (privzeto)", async () => {
    const res = await POST(makeRequest({ ...validBody, system_role: "user" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.system_role).toBe("user");
  });

  // ─── #2: Podvajanje uporabniškega imena ──────────────────────────────────
  it("409 — zavrne uporabnika z obstoječim uporabniškim imenom", async () => {
    let ilikeCall = 0;
    mockAdminFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockImplementation(() => {
          ilikeCall++;
          // Prvi klic = username check → obstaja
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
    expect(body.error).toMatch(/uporabniško ime/i);
  });

  // ─── #3: Sistemske pravice ────────────────────────────────────────────────
  it("403 — navaden uporabnik ne more ustvariti novega uporabnika", async () => {
    mockAdminSingle.mockResolvedValue({
      data: { system_role: "user" },
      error: null,
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrator/i);
  });

  it("201 — admin lahko ustvari drugega admina", async () => {
    const res = await POST(makeRequest({ ...validBody, system_role: "admin" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.system_role).toBe("admin");
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("400 — manjkajoča obvezna polja", async () => {
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/obvezni/i);
  });

  it("400 — geslo je prekratko (< 12 znakov)", async () => {
    const res = await POST(makeRequest({ ...validBody, password: "kratek" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/12/i);
  });

  it("400 — geslo je predolgo (> 64 znakov)", async () => {
    const res = await POST(
      makeRequest({ ...validBody, password: "a".repeat(65) }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/64/i);
  });

  it("409 — zavrne uporabnika z obstoječim emailom", async () => {
    let ilikeCall = 0;
    mockAdminFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockImplementation(() => {
          ilikeCall++;
          // Prvi klic = username → ok, drugi klic = email → obstaja
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
    expect(body.error).toMatch(/e-pošta/i);
  });
});
