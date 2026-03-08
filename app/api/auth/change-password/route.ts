import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function validatePassword(password: string) {
  if (password.length < 12) {
    return "Geslo mora imeti vsaj 12 znakov.";
  }

  if (password.length > 128) {
    return "Geslo ne sme biti daljše od 128 znakov.";
  }

  // nič trimanja, nič spreminjanja whitespace

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // preveri ali je user prijavljen
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { error: "Uporabnik ni prijavljen." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "Staro in novo geslo sta obvezna." },
        { status: 400 },
      );
    }

    // validacija novega gesla
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // preveri staro geslo (ponovna prijava)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Napačno staro geslo." },
        { status: 401 },
      );
    }

    // spremeni geslo
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Geslo uspešno spremenjeno." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Napaka pri spremembi gesla." },
      { status: 500 },
    );
  }
}
