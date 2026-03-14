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

// ─── Mock createServerClient (@/lib/supabase/server) ─────────────────────────
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

// ─── Testi ────────────────────────────────────────────────────────────────────
describe("POST /api/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: prijavljen admin
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });

    // Default: trenutni user je admin
    mockAdminSingle.mockResolvedValue({
      data: { system_role: "admin" },
      error: null,
    });

    // Default: username in email ne obstajata
    mockAdminMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Default: auth user uspešno ustvarjen
    mockAdminCreateUser.mockResolvedValue({
      data: { user: { id: "new-user-1" } },
      error: null,
    });

    // Default: profil uspešno ustvarjen
    mockAdminFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnValue({ maybeSingle: mockAdminMaybeSingle }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      single: mockAdminSingle,
    }));
  });

  // ─── #1: Uspešno dodajanje uporabnika ────────────────────────────────────
  it("201 — uspešno ustvari novega uporabnika", async () => {
    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "geslo123",
        username: "testuser",
        first_name: "Janez",
        last_name: "Novak",
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toMatch(/uspešno/i);
    expect(body.user.email).toBe("test@example.com");
    expect(body.user.username).toBe("testuser");
  });

  // ─── #2: Podvajanje uporabniškega imena ──────────────────────────────────
  it("409 — zavrne uporabnika z obstoječim uporabniškim imenom", async () => {
    // Simuliraj da username že obstaja
    mockAdminFrom.mockImplementation((table) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: "existing-user" }, // username že obstaja
              error: null,
            }),
          }),
          insert: jest.fn().mockResolvedValue({ error: null }),
          single: mockAdminSingle,
        };
      }
    });

    const res = await POST(
      makeRequest({
        email: "novo@example.com",
        password: "geslo123",
        username: "obstojecuser",
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/uporabniško ime/i);
  });

  // ─── #3: Sistemske pravice — non-admin ne more ustvariti uporabnika ───────
  it("403 — navaden uporabnik ne more ustvariti novega uporabnika", async () => {
    // Simuliraj da je trenutni user navaden user (ne admin)
    mockAdminSingle.mockResolvedValue({
      data: { system_role: "user" },
      error: null,
    });

    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "geslo123",
        username: "testuser",
      }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrator/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik ne more ustvariti novega uporabnika", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "geslo123",
        username: "testuser",
      }),
    );

    expect(res.status).toBe(401);
  });

  it("400 — manjkajoča obvezna polja", async () => {
    const res = await POST(
      makeRequest({ email: "test@example.com" }), // manjkata password in username
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/obvezni/i);
  });

  it("400 — geslo je prekratko", async () => {
    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "abc",
        username: "testuser",
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/geslo/i);
  });

  it("409 — zavrne uporabnika z obstoječim emailom", async () => {
    // Prvi ilike (username) vrne null, drugi (email) vrne obstoječega
    let callCount = 0;
    // @ts-ignore
    mockAdminFrom.mockImplementation((table) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1)
                return Promise.resolve({ data: null, error: null }); // username ok
              return Promise.resolve({ data: { id: "existing" }, error: null }); // email obstaja
            }),
          }),
          insert: jest.fn().mockResolvedValue({ error: null }),
          single: mockAdminSingle,
        };
      }
    });

    const res = await POST(
      makeRequest({
        email: "obstojec@example.com",
        password: "geslo123",
        username: "novuser",
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/e-pošta/i);
  });
});
