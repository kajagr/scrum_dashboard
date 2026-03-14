import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // 1. prijava prek Supabase Auth
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData.user) {
      return NextResponse.json(
        { error: "Napačen email ali geslo." },
        { status: 401 },
      );
    }

    const userId = signInData.user.id;

    // 2. preberi trenutno current_login_at iz users tabele
    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("current_login_at")
      .eq("id", userId)
      .maybeSingle();

    if (existingUserError) {
      return NextResponse.json(
        { error: existingUserError.message },
        { status: 500 },
      );
    }

    const previousCurrentLogin = existingUser?.current_login_at ?? null;

    // 3. posodobi login čase
    const { error: updateError } = await supabase
      .from("users")
      .update({
        last_login_at: previousCurrentLogin,
        current_login_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Prijava uspešna.",
        user: {
          id: signInData.user.id,
          email: signInData.user.email,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Napaka pri prijavi." }, { status: 500 });
  }
}
