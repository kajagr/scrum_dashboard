import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticates a user with email and password. If MFA is enabled, returns a factorId for the next step.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "janez.novak@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "geslo123"
 *     responses:
 *       200:
 *         description: Login successful or MFA required
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - description: Login successful
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Prijava uspešna."
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: "janez.novak@example.com"
 *                 - description: MFA required
 *                   type: object
 *                   properties:
 *                     requiresMfa:
 *                       type: boolean
 *                       example: true
 *                     factorId:
 *                       type: string
 *                       example: "abc123factor"
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email in geslo sta obvezna."
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napačen email ali geslo."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri prijavi."
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const body = await request.json();
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email in geslo sta obvezna." },
        { status: 400 },
      );
    }

    // 1. Prijava
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      return NextResponse.json(
        { error: "Napačen email ali geslo." },
        { status: 401 },
      );
    }

    const userId = signInData.user.id;

    // 2. Posodobi login čase
    const { data: existingUser } = await supabase
      .from("users")
      .select("current_login_at")
      .eq("id", userId)
      .maybeSingle();

    await supabase
      .from("users")
      .update({
        last_login_at: existingUser?.current_login_at ?? null,
        current_login_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // 3. Preveri MFA
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (
      aalData?.nextLevel === "aal2" &&
      aalData.nextLevel !== aalData.currentLevel
    ) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (totpFactor) {
        return NextResponse.json(
          { requiresMfa: true, factorId: totpFactor.id },
          { status: 200 },
        );
      }
    }

    // 4. Vrni uspeh
    return NextResponse.json(
      {
        message: "Prijava uspešna.",
        user: { id: signInData.user.id, email: signInData.user.email },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Napaka pri prijavi." }, { status: 500 });
  }
}