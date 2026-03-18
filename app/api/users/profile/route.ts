import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user's profile
 *     description: Returns the profile of the currently authenticated user.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                   example: "janez.novak"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "janez.novak@example.com"
 *                 first_name:
 *                   type: string
 *                   nullable: true
 *                   example: "Janez"
 *                 last_name:
 *                   type: string
 *                   nullable: true
 *                   example: "Novak"
 *                 role:
 *                   type: string
 *                   enum: [admin, user]
 *                   example: "user"
 *                 last_login_at:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "2024-01-15T10:30:00Z"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch profile."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "A server error occurred while fetching the profile."
 */
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
      id: currentUser.id,
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

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user's profile
 *     description: >
 *       Updates the profile of the currently authenticated user.
 *       Username and email must remain unique across all users (case-insensitive).
 *       Optionally updates the password (min 6 characters) and/or email in Supabase Auth.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *                 description: Must be unique (case-insensitive), excluding the current user
 *                 example: "janez.novak"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Must be unique (case-insensitive), excluding the current user
 *                 example: "janez.novak@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 nullable: true
 *                 description: Optional. If provided, must be at least 6 characters.
 *                 example: "novo_geslo_123"
 *               first_name:
 *                 type: string
 *                 nullable: true
 *                 example: "Janez"
 *               last_name:
 *                 type: string
 *                 nullable: true
 *                 example: "Novak"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully."
 *       400:
 *         description: Validation failed or auth update error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missingFields:
 *                       value: "Username and email are required."
 *                     passwordTooShort:
 *                       value: "Password must be at least 6 characters long."
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       409:
 *         description: Username or email already in use by another user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     duplicateUsername:
 *                       value: "Username already exists."
 *                     duplicateEmail:
 *                       value: "Email already exists."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "A server error occurred while updating the profile."
 */
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
