import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

let commonPasswords: Set<string> | null = null;

function getCommonPasswords(): Set<string> {
  if (commonPasswords) return commonPasswords;
  try {
    const filePath = path.join(process.cwd(), "public", "common-passwords.txt");
    const text = fs.readFileSync(filePath, "utf-8");
    commonPasswords = new Set(
      text
        .split("\n")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    commonPasswords = new Set();
  }
  return commonPasswords;
}

function validatePassword(password: string) {
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }

  if (password.length > 64) {
    return "Password cannot be longer than 128 characters.";
  }

  const common = getCommonPasswords();
  if (common.has(password.toLowerCase())) {
    return "This password is too common. Please choose a stronger one.";
  }

  return null;
}

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: >
 *       Changes the password of the currently authenticated user.
 *       Requires the old password for re-authentication.
 *       New password must be at least 12 characters, at most 64 characters,
 *       and must not be a commonly used password.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 example: "staro_geslo123"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Min 12, max 64 characters. Must not be a common password.
 *                 example: "novo_mocno_geslo456"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully."
 *       400:
 *         description: Missing fields or password validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missing:
 *                       value: "Old and new password are required."
 *                     tooShort:
 *                       value: "Password must be at least 12 characters."
 *                     tooLong:
 *                       value: "Password cannot be longer than 128 characters."
 *                     tooCommon:
 *                       value: "This password is too common. Please choose a stronger one."
 *       401:
 *         description: User not authenticated or old password incorrect
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     notAuthenticated:
 *                       value: "User is not authenticated."
 *                     wrongPassword:
 *                       value: "Incorrect old password."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An error occurred while changing the password."
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { error: "User is not authenticated." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "Old and new password are required." },
        { status: 400 },
      );
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Incorrect old password." },
        { status: 401 },
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Password changed successfully." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "An error occurred while changing the password." },
      { status: 500 },
    );
  }
}