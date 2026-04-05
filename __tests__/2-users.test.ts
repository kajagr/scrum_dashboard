import { NextRequest } from "next/server";
import { GET } from "@/app/api/users/route";
import { PUT, DELETE } from "@/app/api/users/[userId]/route";

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminFrom = jest.fn<any, any>();
const mockAdminUpdateUser = jest.fn();
const mockAdminDeleteUser = jest.fn();
const mockAdminCreateUser = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
    auth: {
      admin: {
        updateUserById: (...args: any[]) => mockAdminUpdateUser(...args),
        deleteUser: (...args: any[]) => mockAdminDeleteUser(...args),
        createUser: (...args: any[]) => mockAdminCreateUser(...args),
      },
    },
  })),
}));

// ─── Mock server supabase client ──────────────────────────────────────────────
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

function makePutRequest(userId: string, body: object) {
  return new NextRequest(`http://localhost/api/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest(userId: string) {
  return new NextRequest(`http://localhost/api/users/${userId}`, {
    method: "DELETE",
  });
}

function makeContext(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

const validPutBody = {
  username: "janez.novak",
  email: "janez.novak@example.com",
  first_name: "Janez",
  last_name: "Novak",
  system_role: "user",
};

const updatedUser = {
  id: "user-2",
  username: "janez.novak",
  email: "janez.novak@example.com",
  first_name: "Janez",
  last_name: "Novak",
  system_role: "user",
};

// ─── GET /api/users ────────────────────────────────────────────────────────────
describe("GET /api/users — seznam uporabnikov (#2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
  });

  it("200 — admin dobi seznam vseh uporabnikov", async () => {
    const users = [
      { id: "user-1", username: "admin", system_role: "admin" },
      { id: "user-2", username: "janez", system_role: "user" },
    ];

    let cnt = 0;
    mockAdminFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return makeReadChain({ data: { system_role: "admin" }, error: null });
      // GET — .select("*").order() → thenable
      return makeReadChain({ data: users, error: null });
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it("403 — navaden user ne more videti seznama", async () => {
    mockAdminFrom.mockImplementation(() =>
      makeReadChain({ data: { system_role: "user" }, error: null }),
    );

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrator/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET();
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/users/[userId] ───────────────────────────────────────────────────
describe("PUT /api/users/:userId — urejanje uporabnika (#2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    mockAdminUpdateUser.mockResolvedValue({ error: null });
  });

  function setupPutMocks(
    overrides: {
      isAdmin?: boolean;
      targetExists?: boolean;
      duplicateUsername?: any;
      duplicateEmail?: any;
      authUpdateError?: any;
    } = {},
  ) {
    const {
      isAdmin = true,
      targetExists = true,
      duplicateUsername = null,
      duplicateEmail = null,
      authUpdateError = null,
    } = overrides;

    let cnt = 0;
    mockAdminFrom.mockImplementation(() => {
      cnt++;
      // 1. requireAdmin — system_role check
      if (cnt === 1)
        return makeReadChain({
          data: { system_role: isAdmin ? "admin" : "user" },
          error: null,
        });
      // 2. target user exists (.is("deleted_at", null))
      if (cnt === 2)
        return makeReadChain({
          data: targetExists ? { id: "user-2" } : null,
          error: null,
        });
      // 3. duplicate username (Promise.all — prvi)
      if (cnt === 3)
        return makeReadChain({ data: duplicateUsername, error: null });
      // 4. duplicate email (Promise.all — drugi)
      if (cnt === 4)
        return makeReadChain({ data: duplicateEmail, error: null });
      // 5. update
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedUser, error: null }),
      };
    });

    mockAdminUpdateUser.mockResolvedValue({ error: authUpdateError });
  }

  it("200 — admin uspešno posodobi osebne podatke uporabnika", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest("user-2", validPutBody),
      makeContext("user-2"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe("janez.novak");
    expect(body.email).toBe("janez.novak@example.com");
  });

  it("200 — admin uspešno spremeni geslo uporabnika", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest("user-2", {
        ...validPutBody,
        password: "novo_varno_geslo_123",
      }),
      makeContext("user-2"),
    );
    expect(res.status).toBe(200);
    expect(mockAdminUpdateUser).toHaveBeenCalledWith(
      "user-2",
      expect.objectContaining({ password: "novo_varno_geslo_123" }),
    );
  });

  it("200 — admin uspešno spremeni sistemske pravice", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest("user-2", { ...validPutBody, system_role: "admin" }),
      makeContext("user-2"),
    );
    expect(res.status).toBe(200);
  });

  it("409 — zavrne podvojeno uporabniško ime", async () => {
    setupPutMocks({ duplicateUsername: { id: "other-user" } });
    const res = await PUT(
      makePutRequest("user-2", validPutBody),
      makeContext("user-2"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/uporabniško ime/i);
  });

  it("409 — zavrne podvojen e-poštni naslov", async () => {
    setupPutMocks({ duplicateEmail: { id: "other-user" } });
    const res = await PUT(
      makePutRequest("user-2", validPutBody),
      makeContext("user-2"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/e-poštni/i);
  });

  it("400 — manjkajoče obvezno polje", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest("user-2", { email: "test@test.com" }),
      makeContext("user-2"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/obvezni/i);
  });

  it("400 — neveljaven format e-pošte", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest("user-2", { ...validPutBody, email: "not-an-email" }),
      makeContext("user-2"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/e-poštnega/i);
  });

  it("400 — geslo prekratko (< 12 znakov)", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest("user-2", { ...validPutBody, password: "kratko" }),
      makeContext("user-2"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/vsaj 12/i);
  });

  it("400 — geslo predolgo (> 64 znakov)", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest("user-2", { ...validPutBody, password: "a".repeat(65) }),
      makeContext("user-2"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/64/i);
  });

  it("404 — uporabnik ne obstaja", async () => {
    setupPutMocks({ targetExists: false });
    const res = await PUT(
      makePutRequest("nonexistent", validPutBody),
      makeContext("nonexistent"),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ne obstaja/i);
  });

  it("403 — navaden user ne more urejati uporabnikov", async () => {
    setupPutMocks({ isAdmin: false });
    const res = await PUT(
      makePutRequest("user-2", validPutBody),
      makeContext("user-2"),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrator/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PUT(
      makePutRequest("user-2", validPutBody),
      makeContext("user-2"),
    );
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/users/[userId] ────────────────────────────────────────────────
describe("DELETE /api/users/:userId — brisanje uporabnika (#2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    mockAdminUpdateUser.mockResolvedValue({ error: null });
  });

  function setupDeleteMocks(
    overrides: {
      isAdmin?: boolean;
      targetExists?: boolean;
      softDeleteError?: any;
    } = {},
  ) {
    const {
      isAdmin = true,
      targetExists = true,
      softDeleteError = null,
    } = overrides;

    let cnt = 0;
    mockAdminFrom.mockImplementation(() => {
      cnt++;
      // 1. requireAdmin
      if (cnt === 1)
        return makeReadChain({
          data: { system_role: isAdmin ? "admin" : "user" },
          error: null,
        });
      // 2. target user exists (.is("deleted_at", null))
      if (cnt === 2)
        return makeReadChain({
          data: targetExists ? { id: "user-2" } : null,
          error: null,
        });
      // 3. soft delete — .update().eq()
      if (cnt === 3)
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: softDeleteError }),
        };
      // 4. project_members — .delete().eq()
      if (cnt === 4)
        return {
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        };
      // 5. tasks — .update().eq().is().neq()
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        neq: jest.fn().mockResolvedValue({ error: null }),
      };
    });
  }

  it("200 — admin uspešno soft-delete uporabnika", async () => {
    setupDeleteMocks();
    const res = await DELETE(
      makeDeleteRequest("user-2"),
      makeContext("user-2"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/uspešno izbrisan/i);
  });

  it("200 — po brisanju je user baniran v auth", async () => {
    setupDeleteMocks();
    const res = await DELETE(
      makeDeleteRequest("user-2"),
      makeContext("user-2"),
    );
    expect(res.status).toBe(200);
    expect(mockAdminUpdateUser).toHaveBeenCalledWith(
      "user-2",
      expect.objectContaining({ ban_duration: expect.any(String) }),
    );
  });

  it("400 — admin ne more izbrisati samega sebe", async () => {
    setupDeleteMocks();
    const res = await DELETE(
      makeDeleteRequest("admin-1"),
      makeContext("admin-1"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lastnega računa/i);
  });

  it("404 — uporabnik ne obstaja ali je že izbrisan", async () => {
    setupDeleteMocks({ targetExists: false });
    const res = await DELETE(
      makeDeleteRequest("nonexistent"),
      makeContext("nonexistent"),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ne obstaja/i);
  });

  it("403 — navaden user ne more brisati uporabnikov", async () => {
    setupDeleteMocks({ isAdmin: false });
    const res = await DELETE(
      makeDeleteRequest("user-2"),
      makeContext("user-2"),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrator/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await DELETE(
      makeDeleteRequest("user-2"),
      makeContext("user-2"),
    );
    expect(res.status).toBe(401);
  });
});
