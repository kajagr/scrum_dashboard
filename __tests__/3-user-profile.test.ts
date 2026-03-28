import { PUT } from "@/app/api/users/profile/route";
import { POST as CHANGE_PASSWORD } from "@/app/api/auth/change-password/route";
import { NextRequest } from "next/server";

// ─── Mock fs (common-passwords file read) ────────────────────────────────────
jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "password123456789\nqwertyuiopasdf\n"),
}));

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminMaybeSingle = jest.fn();
const mockAdminUpdateUserById = jest.fn();
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
    auth: {
      admin: {
        updateUserById: (...args: any[]) => mockAdminUpdateUserById(...args),
      },
    },
  })),
}));

// ─── Mock createServerClient ──────────────────────────────────────────────────
const mockGetUser = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signInWithPassword: mockSignInWithPassword,
        updateUser: mockUpdateUser,
      },
    }),
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePutRequest(body: object) {
  return new Request("http://localhost/api/users/profile", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Default data ─────────────────────────────────────────────────────────────
const validProfileBody = {
  username: "newusername",
  email: "new@example.com",
  first_name: "Jana",
  last_name: "Novak",
};

const validPasswordBody = {
  oldPassword: "staro_geslo_12345",
  newPassword: "novo_mocno_geslo456",
};

// ─── Setup mocks for PUT /api/users/profile ───────────────────────────────────
function setupProfileMocks(
  overrides: {
    duplicateUsername?: any;
    duplicateEmail?: any;
    updateUserByIdResult?: any;
    updateProfileResult?: any;
  } = {},
) {
  const duplicateUsername = overrides.duplicateUsername ?? null;
  const duplicateEmail = overrides.duplicateEmail ?? null;
  const updateUserByIdResult = overrides.updateUserByIdResult ?? {
    error: null,
  };
  const updateProfileResult = overrides.updateProfileResult ?? { error: null };

  // username check → email check (both via .ilike().neq().maybeSingle())
  let maybeSingleCall = 0;
  mockAdminMaybeSingle.mockImplementation(() => {
    maybeSingleCall++;
    if (maybeSingleCall === 1)
      return Promise.resolve({ data: duplicateUsername, error: null });
    return Promise.resolve({ data: duplicateEmail, error: null });
  });

  mockAdminFrom.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnValue({ maybeSingle: mockAdminMaybeSingle }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(updateProfileResult),
  }));

  mockAdminUpdateUserById.mockResolvedValue(updateUserByIdResult);
}

// ─── PUT /api/users/profile TESTS ─────────────────────────────────────────────
describe("PUT /api/users/profile — sprememba uporabniškega imena in osebnih podatkov (#3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "old@example.com" } },
      error: null,
    });
    setupProfileMocks();
  });

  // ─── #1: Uspešna sprememba uporabniškega imena ────────────────────────────
  it("200 — uspešno posodobi uporabniško ime", async () => {
    const res = await PUT(makePutRequest(validProfileBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/profile updated successfully/i);
  });

  // ─── #2: Podvajanje uporabniškega imena ───────────────────────────────────
  it("409 — zavrne podvojeno uporabniško ime", async () => {
    setupProfileMocks({ duplicateUsername: { id: "other-user" } });

    const res = await PUT(makePutRequest(validProfileBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/username already exists/i);
  });

  // ─── #3: Podvajanje emaila ────────────────────────────────────────────────
  it("409 — zavrne podvojen email", async () => {
    setupProfileMocks({ duplicateEmail: { id: "other-user" } });

    const res = await PUT(makePutRequest(validProfileBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/email already exists/i);
  });

  // ─── #4: Sprememba osebnih podatkov ──────────────────────────────────────
  it("200 — uspešno posodobi ime in priimek", async () => {
    const res = await PUT(
      makePutRequest({
        ...validProfileBody,
        first_name: "Novo",
        last_name: "Ime",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/profile updated successfully/i);
  });

  // ─── #5: Validacija ───────────────────────────────────────────────────────
  it("400 — manjkata username in email", async () => {
    const res = await PUT(makePutRequest({ first_name: "Jana" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/username and email are required/i);
  });

  it("400 — geslo je prekratko (< 6 znakov)", async () => {
    const res = await PUT(
      makePutRequest({ ...validProfileBody, password: "abc" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 6 characters/i);
  });

  // ─── #6: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik ne more posodobiti profila", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PUT(makePutRequest(validProfileBody));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ─── #7: Napaka pri posodobitvi auth ──────────────────────────────────────
  it("400 — vrne napako če auth posodobitev ne uspe", async () => {
    setupProfileMocks({
      updateUserByIdResult: { error: { message: "Auth update failed" } },
    });

    const res = await PUT(
      makePutRequest({ ...validProfileBody, password: "veljavno_geslo_123" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/auth update failed/i);
  });
});

// ─── POST /api/auth/change-password TESTS ─────────────────────────────────────
describe("POST /api/auth/change-password — sprememba gesla (#3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  // ─── #1: Uspešna sprememba gesla ──────────────────────────────────────────
  it("200 — uspešno spremeni geslo", async () => {
    const res = await CHANGE_PASSWORD(makePostRequest(validPasswordBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/password changed successfully/i);
  });

  // ─── #2: Validacija novega gesla ──────────────────────────────────────────
  it("400 — novo geslo je prekratko (< 12 znakov)", async () => {
    const res = await CHANGE_PASSWORD(
      makePostRequest({ ...validPasswordBody, newPassword: "kratko123" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 12 characters/i);
  });

  it("400 — novo geslo je predolgo (> 64 znakov)", async () => {
    const res = await CHANGE_PASSWORD(
      makePostRequest({ ...validPasswordBody, newPassword: "a".repeat(65) }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/longer than/i);
  });

  it("400 — novo geslo je preveč pogosto (common password)", async () => {
    const res = await CHANGE_PASSWORD(
      makePostRequest({
        ...validPasswordBody,
        newPassword: "password123456789",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too common/i);
  });

  // ─── #3: Napačno staro geslo ──────────────────────────────────────────────
  it("401 — napačno staro geslo", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const res = await CHANGE_PASSWORD(makePostRequest(validPasswordBody));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/incorrect old password/i);
  });

  // ─── #4: Manjkajoča polja ─────────────────────────────────────────────────
  it("400 — manjkata oldPassword in newPassword", async () => {
    const res = await CHANGE_PASSWORD(makePostRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/old and new password are required/i);
  });

  it("400 — manjka newPassword", async () => {
    const res = await CHANGE_PASSWORD(
      makePostRequest({ oldPassword: "staro_geslo_12345" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/old and new password are required/i);
  });

  // ─── #5: Avtentikacija ────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik ne more spremeniti gesla", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await CHANGE_PASSWORD(makePostRequest(validPasswordBody));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/not authenticated/i);
  });
});
