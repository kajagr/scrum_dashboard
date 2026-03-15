import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// GET /api/users - Fetch all users (admin only)
export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Preveri ali je admin
    const { data: currentUserData } = await supabaseAdmin
      .from("users")
      .select("system_role")
      .eq("id", currentUser.id)
      .single();

    if (currentUserData?.system_role !== "admin") {
      return NextResponse.json(
        { error: "Samo administrator lahko vidi vse uporabnike." },
        { status: 403 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju uporabnikov." },
      { status: 500 },
    );
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(req: Request) {
  try {
    // Preveri ali je klicatelj prijavljen
    const supabase = await createServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Preveri ali je admin
    const { data: currentUserData } = await supabaseAdmin
      .from("users")
      .select("system_role")
      .eq("id", currentUser.id)
      .single();

    if (currentUserData?.system_role !== "admin") {
      return NextResponse.json(
        { error: "Samo administrator lahko ustvarja uporabnike." },
        { status: 403 },
      );
    }

    const body = await req.json();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const username = body.username?.trim();
    const firstName = body.first_name?.trim() || null;
    const lastName = body.last_name?.trim() || null;
    const systemRole = body.system_role === "admin" ? "admin" : "user";

    // Preveri obvezna polja
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, geslo in uporabniško ime so obvezni." },
        { status: 400 },
      );
    }

    // Preveri dolžino gesla
    if (password.length < 12) {
      return NextResponse.json(
        { error: "Geslo mora imeti vsaj 12 znakov." },
        { status: 400 },
      );
    }

    // Preveri ali username obstaja
    const { data: existingUsername } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existingUsername) {
      return NextResponse.json(
        { error: "Uporabniško ime že obstaja." },
        { status: 409 },
      );
    }

    // Preveri ali email obstaja
    const { data: existingEmail } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: "E-pošta že obstaja." },
        { status: 409 },
      );
    }

    // Ustvari auth user
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

    // Ustvari profil v users tabeli (vedno kot "user")
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      system_role: systemRole,
    });

    // Če profil ne uspe, izbriši auth userja
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: "Napaka pri ustvarjanju profila: " + profileError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Uporabnik uspešno ustvarjen.",
        user: {
          id: authData.user.id,
          email,
          username,
          system_role: systemRole,
        }
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Napaka pri obdelavi zahteve." },
      { status: 400 },
    );
  }
}
