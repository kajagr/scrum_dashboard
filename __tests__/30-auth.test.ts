import { NextRequest } from "next/server";
import { POST as LOGIN } from "@/app/api/auth/login/route";
import { POST as CHANGE_PASSWORD } from "@/app/api/auth/change-password/route";

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockGetUser = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockUpdateUser = jest.fn();
const mockMfaGetLevel = jest.fn();
const mockMfaListFactors = jest.fn();
const mockFrom = jest.fn<any, any>();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signInWithPassword: mockSignInWithPassword,
        updateUser: mockUpdateUser,
        mfa: {
          getAuthenticatorAssuranceLevel: mockMfaGetLevel,
          listFactors: mockMfaListFactors,
        },
      },
      from: (...args: any[]) => mockFrom(...args),
    }),
  ),
}));

// ─── Mock fs (za common-passwords.txt) ───────────────────────────────────────
jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "password123456\nqwerty123456\n"),
}));

// ─── Helper funkcije ──────────────────────────────────────────────────────────
function makeLoginRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeChangePasswordRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─── TESTI ZA LOGIN ───────────────────────────────────────────────────────────
describe("POST /api/auth/login (#30)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: uspešna prijava
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@test.com" } },
      error: null,
    });

    // Default: posodobi login čase
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest
        .fn()
        .mockResolvedValue({ data: { current_login_at: null }, error: null }),
      update: jest.fn().mockReturnThis(),
    }));

    // Default: ni MFA
    mockMfaGetLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
  });

  // ─── #1: Pravilno geslo in email ──────────────────────────────────────────
  it("200 — uspešna prijava s pravilnimi podatki", async () => {
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({
              data: { current_login_at: null },
              error: null,
            }),
        };
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
    });

    const res = await LOGIN(
      makeLoginRequest({ email: "test@test.com", password: "geslo123456" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/uspešna/i);
  });

  // ─── #2: Napačno geslo ────────────────────────────────────────────────────
  it("401 — napačno geslo", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await LOGIN(
      makeLoginRequest({ email: "test@test.com", password: "napačno" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    // Generična napaka — ne razkrije ali je napačno geslo ali email
    expect(body.error).toMatch(/email|geslo/i);
  });

  // ─── #3: Napačen email ────────────────────────────────────────────────────
  it("401 — napačen email", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await LOGIN(
      makeLoginRequest({ email: "wrong@test.com", password: "geslo123456" }),
    );
    expect(res.status).toBe(401);
    // Enaka generična napaka kot pri napačnem geslu
    const body = await res.json();
    expect(body.error).toMatch(/email|geslo/i);
  });

  // ─── MFA ──────────────────────────────────────────────────────────────────
  it("200 — vrne requiresMfa če ima user 2FA", async () => {
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({
              data: { current_login_at: null },
              error: null,
            }),
        };
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
    });

    mockMfaGetLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });

    const res = await LOGIN(
      makeLoginRequest({ email: "test@test.com", password: "geslo123456" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiresMfa).toBe(true);
    expect(body.factorId).toBe("factor-1");
  });

  it("400 — manjkata email in geslo", async () => {
    const res = await LOGIN(makeLoginRequest({}));
    expect(res.status).toBe(400);
  });
});

// ─── TESTI ZA CHANGE PASSWORD ─────────────────────────────────────────────────
describe("POST /api/auth/change-password (#30)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@test.com" } },
      error: null,
    });

    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mockUpdateUser.mockResolvedValue({ error: null });
  });

  // ─── #1: Uspešna sprememba gesla ──────────────────────────────────────────
  it("200 — uspešno spremeni geslo", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "StaroGeslo123",
        newPassword: "NovoGeslo456!",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/successfully/i);
  });

  // ─── #2: Napačno staro geslo ──────────────────────────────────────────────
  it("401 — napačno staro geslo", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid credentials" },
    });

    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "NapačnoGeslo",
        newPassword: "NovoGeslo456!",
      }),
    );
    expect(res.status).toBe(401);
  });

  // ─── #3: Geslo prekratko (< 12 znakov) ───────────────────────────────────
  it("400 — novo geslo je prekratko (< 12 znakov)", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "StaroGeslo123",
        newPassword: "kratek",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/12/i);
  });

  // ─── #4: Geslo predolgo (> 64 znakov) ────────────────────────────────────
  it("400 — novo geslo je predolgo (> 64 znakov)", async () => {
    const longPassword = "a".repeat(65);
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "StaroGeslo123",
        newPassword: longPassword,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/128|64/i);
  });

  // ─── #5: Pogosto geslo (iz slovarja) ─────────────────────────────────────
  it("400 — geslo je v seznamu pogostih gesel", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "StaroGeslo123",
        newPassword: "password123456",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/common/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("400 — manjkata oldPassword ali newPassword", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "StaroGeslo123",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "StaroGeslo123",
        newPassword: "NovoGeslo456!",
      }),
    );
    expect(res.status).toBe(401);
  });
});
