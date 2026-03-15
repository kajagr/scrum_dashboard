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
