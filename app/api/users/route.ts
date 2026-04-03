import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function normalizeEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.replace(/\./g, "")}@${domain}`;
}

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Returns all users in the system. Only administrators can access this endpoint.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: "janez.novak@example.com"
 *                   username:
 *                     type: string
 *                     example: "janez.novak"
 *                   first_name:
 *                     type: string
 *                     nullable: true
 *                     example: "Janez"
 *                   last_name:
 *                     type: string
 *                     nullable: true
 *                     example: "Novak"
 *                   system_role:
 *                     type: string
 *                     enum: [admin, user]
 *                     example: "user"
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00Z"
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
 *       403:
 *         description: User is not an administrator
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Only administrators can view all users."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An error occurred while fetching users."
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

    const { data: currentUserData } = await supabaseAdmin
      .from("users")
      .select("system_role")
      .eq("id", currentUser.id)
      .single();

    if (currentUserData?.system_role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can view all users." },
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
      { error: "An error occurred while fetching users." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     description: >
 *       Creates a new user in both Supabase Auth and the users table.
 *       Only administrators can create users.
 *       Username and email must be unique (case-insensitive).
 *       Password must be between 12 and 64 characters.
 *       If profile creation fails after auth user is created, the auth user is automatically deleted.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "janez.novak@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Min 12, max 64 characters
 *                 example: "strong_password_123"
 *               username:
 *                 type: string
 *                 description: Must be unique (case-insensitive)
 *                 example: "janez.novak"
 *               first_name:
 *                 type: string
 *                 nullable: true
 *                 example: "Janez"
 *               last_name:
 *                 type: string
 *                 nullable: true
 *                 example: "Novak"
 *               system_role:
 *                 type: string
 *                 enum: [admin, user]
 *                 description: Defaults to "user" if not provided or not "admin"
 *                 example: "user"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User created successfully."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "janez.novak@example.com"
 *                     username:
 *                       type: string
 *                       example: "janez.novak"
 *                     system_role:
 *                       type: string
 *                       enum: [admin, user]
 *                       example: "user"
 *       400:
 *         description: Validation failed or auth error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missingFields:
 *                       value: "Email, password and username are required."
 *                     passwordTooShort:
 *                       value: "Password must be at least 12 characters."
 *                     passwordTooLong:
 *                       value: "Password cannot be longer than 64 characters."
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
 *       403:
 *         description: User is not an administrator
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Only administrators can create users."
 *       409:
 *         description: Username or email already exists
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
 *                   example: "Error creating user profile: ..."
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUserData } = await supabaseAdmin
      .from("users")
      .select("system_role")
      .eq("id", currentUser.id)
      .single();

    if (currentUserData?.system_role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can create users." },
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

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, password and username are required." },
        { status: 400 },
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters." },
        { status: 400 },
      );
    }

    if (password.length > 64) {
      return NextResponse.json(
        { error: "Password cannot be longer than 64 characters." },
        { status: 400 },
      );
    }

    // Username duplicate check
    const { data: existingUsername } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already exists." },
        { status: 409 },
      );
    }

    // Email duplicate check — normaliziramo pike v lokalnem delu
    const { data: allUsers } = await supabaseAdmin
      .from("users")
      .select("email");

    const normalizedNew = normalizeEmail(email);
    const isDuplicateEmail = allUsers?.some(
      (u) => normalizeEmail(u.email.toLowerCase()) === normalizedNew,
    );

    if (isDuplicateEmail) {
      return NextResponse.json(
        { error: "Email already exists." },
        { status: 409 },
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Error creating user." },
        { status: 400 },
      );
    }

    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      system_role: systemRole,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: "Error creating user profile: " + profileError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "User created successfully.",
        user: {
          id: authData.user.id,
          email,
          username,
          system_role: systemRole,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "An error occurred while processing the request." },
      { status: 400 },
    );
  }
}
