import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
 *                   example: "Samo administrator lahko vidi vse uporabnike."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri pridobivanju uporabnikov."
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
 *                 example: "mocno_geslo_123"
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
 *                   example: "Uporabnik uspešno ustvarjen."
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
 *                       value: "Email, geslo in uporabniško ime so obvezni."
 *                     passwordTooShort:
 *                       value: "Geslo mora imeti vsaj 12 znakov."
 *                     passwordTooLong:
 *                       value: "Geslo ima lahko največ 64 znakov."
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
 *                   example: "Samo administrator lahko ustvarja uporabnike."
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
 *                       value: "Uporabniško ime že obstaja."
 *                     duplicateEmail:
 *                       value: "E-pošta že obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri ustvarjanju profila: ..."
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

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, geslo in uporabniško ime so obvezni." },
        { status: 400 },
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        { error: "Geslo mora imeti vsaj 12 znakov." },
        { status: 400 },
      );
    }

    if (password.length > 64) {
      return NextResponse.json(
        { error: "Geslo ima lahko največ 64 znakov." },
        { status: 400 },
      );
    }

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
        },
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