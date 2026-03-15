import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

// Naloži seznam pogostih gesel (500 namesto 100) enkrat ob zagonu serverja - iz rockyyou:
// https://github.com/gsuberland/CommonPasswordsByPolicy/blob/main/from-rockyou/pwlist_cc_len12_cls1.txt
// shranjeno v public/common-passwords
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
    // Če datoteka ne obstaja, vrni prazen set
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

  // Preveri pogosta gesla
  const common = getCommonPasswords();
  if (common.has(password.toLowerCase())) {
    return "This password is too common. Please choose a stronger one.";
  }

  // no trimming, no changing whitespace

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // check if user is logged in
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

    // validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // verify old password (re-authenticate)
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

    // change password
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
