import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const username = body.username?.trim();
    const firstName = body.firstName?.trim() || null;
    const lastName = body.lastName?.trim() || null;
    const systemRole = body.systemRole?.trim() || "user";

    // preveri obvezna polja
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, password in username so obvezni." },
        { status: 400 },
      );
    }

    // preveri dolžino gesla
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Geslo mora imeti vsaj 6 znakov." },
        { status: 400 },
      );
    }

    // preveri ali username obstaja
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "Username že obstaja." },
        { status: 409 },
      );
    }

    // ustvari auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Napaka pri ustvarjanju uporabnika." },
        { status: 400 },
      );
    }

    // ustvari profil v users tabeli
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      system_role: systemRole,
    });

    // če profil ne uspe, izbriši auth userja
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: "Uporabnik ustvarjen v auth, profil pa ne." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Uporabnik uspešno ustvarjen." },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Neveljaven request body." },
      { status: 400 },
    );
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, username, first_name, last_name")
    .order("first_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
