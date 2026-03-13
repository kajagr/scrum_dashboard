import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// GET /api/users/profile - current logged-in user profile
export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "username, email, first_name, last_name, system_role, last_login_at",
      )
      .eq("id", currentUser.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to fetch profile." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      username: data.username,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.system_role,
      last_login_at: data.last_login_at,
    });
  } catch {
    return NextResponse.json(
      { error: "A server error occurred while fetching the profile." },
      { status: 500 },
    );
  }
}

// PUT /api/users/profile - update current logged-in user profile
export async function PUT(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const firstName = body.first_name?.trim() || null;
    const lastName = body.last_name?.trim() || null;

    if (!username || !email) {
      return NextResponse.json(
        { error: "Username and email are required." },
        { status: 400 },
      );
    }

    // Check if username is used by another user
    const { data: existingUsername } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", username)
      .neq("id", currentUser.id)
      .maybeSingle();

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already exists." },
        { status: 409 },
      );
    }

    // Check if email is used by another user
    const { data: existingEmail } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("email", email)
      .neq("id", currentUser.id)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already exists." },
        { status: 409 },
      );
    }

    // Update auth email / password if needed
    const updateAuthPayload: { email?: string; password?: string } = {};

    if (email) {
      updateAuthPayload.email = email;
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long." },
          { status: 400 },
        );
      }

      updateAuthPayload.password = password;
    }

    if (Object.keys(updateAuthPayload).length > 0) {
      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(
          currentUser.id,
          updateAuthPayload,
        );

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    // Update profile table
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .update({
        username,
        email,
        first_name: firstName,
        last_name: lastName,
      })
      .eq("id", currentUser.id);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Profile updated successfully.",
    });
  } catch {
    return NextResponse.json(
      { error: "A server error occurred while updating the profile." },
      { status: 500 },
    );
  }
}
