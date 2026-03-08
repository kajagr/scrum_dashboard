import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function validatePassword(password: string) {
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }

  if (password.length > 128) {
    return "Password cannot be longer than 128 characters.";
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
