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

// ─── Mock fs (for common-passwords.txt) ──────────────────────────────────────
jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "password123456\nqwerty123456\n"),
}));

// ─── Helper functions ─────────────────────────────────────────────────────────
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

// ─── LOGIN TESTS ──────────────────────────────────────────────────────────────
describe("POST /api/auth/login (#30)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: successful login
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@test.com" } },
      error: null,
    });

    // Default: update login timestamps
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { current_login_at: null },
        error: null,
      }),
      update: jest.fn().mockReturnThis(),
    }));

    // Default: no MFA
    mockMfaGetLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
  });

  // ─── #1: Correct email and password ──────────────────────────────────────
  it("200 — successful login with valid credentials", async () => {
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
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
    expect(body.message).toMatch(/login successful/i);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("test@test.com");
  });

  // ─── #2: Wrong password ───────────────────────────────────────────────────
  it("401 — wrong password", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await LOGIN(
      makeLoginRequest({ email: "test@test.com", password: "wrongpassword" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    // Generic error — does not reveal whether email or password is wrong
    expect(body.error).toMatch(/email|password/i);
  });

  // ─── #3: Wrong email ──────────────────────────────────────────────────────
  it("401 — wrong email", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await LOGIN(
      makeLoginRequest({ email: "wrong@test.com", password: "geslo123456" }),
    );
    expect(res.status).toBe(401);
    // Same generic error as wrong password
    const body = await res.json();
    expect(body.error).toMatch(/email|password/i);
  });

  // ─── #4: MFA ──────────────────────────────────────────────────────────────
  it("200 — returns requiresMfa if user has 2FA enabled", async () => {
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
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

  // ─── #5: Missing email and password ───────────────────────────────────────
  it("400 — missing email and password", async () => {
    const res = await LOGIN(makeLoginRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email.*password|required/i);
  });

  // ─── #6: Missing password only ────────────────────────────────────────────
  it("400 — missing password", async () => {
    const res = await LOGIN(makeLoginRequest({ email: "test@test.com" }));
    expect(res.status).toBe(400);
  });

  // ─── #7: Missing email only ───────────────────────────────────────────────
  it("400 — missing email", async () => {
    const res = await LOGIN(makeLoginRequest({ password: "geslo123456" }));
    expect(res.status).toBe(400);
  });
});

// ─── CHANGE PASSWORD TESTS ────────────────────────────────────────────────────
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

  // ─── #1: Successful password change ──────────────────────────────────────
  it("200 — successfully changes password", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "OldPassword123",
        newPassword: "NewPassword456!",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/successfully/i);
  });

  // ─── #2: Wrong old password ───────────────────────────────────────────────
  it("401 — wrong old password", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid credentials" },
    });

    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "WrongPassword",
        newPassword: "NewPassword456!",
      }),
    );
    expect(res.status).toBe(401);
  });

  // ─── #3: Password too short (< 12 characters) ────────────────────────────
  it("400 — new password is too short (< 12 characters)", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "OldPassword123",
        newPassword: "short",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/12/i);
  });

  // ─── #4: Password too long (> 64 characters) ─────────────────────────────
  it("400 — new password is too long (> 64 characters)", async () => {
    const longPassword = "a".repeat(65);
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "OldPassword123",
        newPassword: longPassword,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/128|64/i);
  });

  // ─── #5: Common password (from dictionary) ────────────────────────────────
  it("400 — password is in the list of common passwords", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "OldPassword123",
        newPassword: "password123456",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/common/i);
  });

  // ─── #6: Missing oldPassword or newPassword ───────────────────────────────
  it("400 — missing oldPassword or newPassword", async () => {
    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "OldPassword123",
      }),
    );
    expect(res.status).toBe(400);
  });

  // ─── #7: Unauthenticated user ─────────────────────────────────────────────
  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await CHANGE_PASSWORD(
      makeChangePasswordRequest({
        oldPassword: "OldPassword123",
        newPassword: "NewPassword456!",
      }),
    );
    expect(res.status).toBe(401);
  });
});
