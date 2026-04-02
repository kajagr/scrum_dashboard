import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{ userId: string }>;
};

async function requireAdmin(): Promise<
  { adminId: string; error: null } | { adminId: null; error: NextResponse }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      adminId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("system_role")
    .eq("id", user.id)
    .single();

  if (userData?.system_role !== "admin") {
    return {
      adminId: null,
      error: NextResponse.json(
        { error: "Samo administratorji lahko upravljajo z uporabniki." },
        { status: 403 },
      ),
    };
  }

  return { adminId: user.id, error: null };
}

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update a user (admin only)
 *     description: >
 *       Updates a user's username, first name, last name, email, system role, and optionally password.
 *       Only system administrators can perform this action.
 *       Username and email must be unique (case-insensitive) across all users, excluding the target user.
 *       If a new password is provided, it must be between 12 and 64 characters.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user to update
 *         example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
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
 *                 description: Must be unique (case-insensitive), excluding the target user
 *                 example: "janez.novak"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Must be unique (case-insensitive), excluding the target user
 *                 example: "janez.novak@example.com"
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
 *                 example: "user"
 *               password:
 *                 type: string
 *                 format: password
 *                 nullable: true
 *                 description: Optional. If provided, must be between 12 and 64 characters.
 *                 example: "novo_varno_geslo_123"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "janez.novak@example.com"
 *                 username:
 *                   type: string
 *                   example: "janez.novak"
 *                 first_name:
 *                   type: string
 *                   nullable: true
 *                   example: "Janez"
 *                 last_name:
 *                   type: string
 *                   nullable: true
 *                   example: "Novak"
 *                 system_role:
 *                   type: string
 *                   enum: [admin, user]
 *                   example: "user"
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missingFields:
 *                       value: "Uporabniško ime in e-pošta sta obvezni."
 *                     invalidEmail:
 *                       value: "Neveljaven format e-poštnega naslova."
 *                     passwordTooShort:
 *                       value: "Geslo mora imeti vsaj 12 znakov."
 *                     passwordTooLong:
 *                       value: "Geslo ne sme biti daljše od 64 znakov."
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
 *         description: Caller is not an administrator
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Samo administratorji lahko upravljajo z uporabniki."
 *       404:
 *         description: Target user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Uporabnik ne obstaja."
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
 *                       value: "Uporabniško ime že obstaja."
 *                     duplicateEmail:
 *                       value: "E-poštni naslov že obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri posodabljanju uporabnika."
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { adminId, error: authError } = await requireAdmin();
  if (authError) return authError;

  const { userId } = await params;

  const body = await req.json();
  const username = body.username?.trim();
  const email = body.email?.trim().toLowerCase();
  const firstName = body.first_name?.trim() || null;
  const lastName = body.last_name?.trim() || null;
  const systemRole = body.system_role === "admin" ? "admin" : "user";
  const password = body.password?.trim() || null;

  // Validation
  if (!username || !email) {
    return NextResponse.json(
      { error: "Uporabniško ime in e-pošta sta obvezni." },
      { status: 400 },
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Neveljaven format e-poštnega naslova." },
      { status: 400 },
    );
  }

  if (password !== null) {
    if (password.length < 12) {
      return NextResponse.json(
        { error: "Geslo mora imeti vsaj 12 znakov." },
        { status: 400 },
      );
    }
    if (password.length > 64) {
      return NextResponse.json(
        { error: "Geslo ne sme biti daljše od 64 znakov." },
        { status: 400 },
      );
    }
  }

  // Check target user exists
  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json(
      { error: "Uporabnik ne obstaja." },
      { status: 404 },
    );
  }

  // Duplicate checks (exclude self)
  const [{ data: duplicateUsername }, { data: duplicateEmail }] =
    await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id")
        .ilike("username", username)
        .neq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id")
        .ilike("email", email)
        .neq("id", userId)
        .maybeSingle(),
    ]);

  if (duplicateUsername) {
    return NextResponse.json(
      { error: "Uporabniško ime že obstaja." },
      { status: 409 },
    );
  }
  if (duplicateEmail) {
    return NextResponse.json(
      { error: "E-poštni naslov že obstaja." },
      { status: 409 },
    );
  }

  // Update Supabase Auth (email + optional password)
  const authPayload: { email?: string; password?: string } = { email };
  if (password) authPayload.password = password;

  const { error: authUpdateError } =
    await supabaseAdmin.auth.admin.updateUserById(userId, authPayload);

  if (authUpdateError) {
    return NextResponse.json(
      { error: authUpdateError.message },
      { status: 400 },
    );
  }

  // Update users table
  const { data, error: updateError } = await supabaseAdmin
    .from("users")
    .update({ username, email, first_name: firstName, last_name: lastName, system_role: systemRole })
    .eq("id", userId)
    .select("id, email, username, first_name, last_name, system_role")
    .single();

  if (updateError) {
    console.error("PUT /api/users/[userId] error:", updateError);
    return NextResponse.json(
      { error: "Napaka pri posodabljanju uporabnika." },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete a user (admin only)
 *     description: >
 *       Permanently deletes a user from both the users table and Supabase Auth.
 *       Only system administrators can perform this action.
 *       An administrator cannot delete their own account.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user to delete
 *         example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Uporabnik je bil uspešno izbrisan."
 *       400:
 *         description: Admin attempted to delete their own account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Ne morete izbrisati lastnega računa."
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
 *         description: Caller is not an administrator
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Samo administratorji lahko upravljajo z uporabniki."
 *       404:
 *         description: Target user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Uporabnik ne obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri brisanju uporabnika."
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { adminId, error: authError } = await requireAdmin();
  if (authError) return authError;

  const { userId } = await params;

  // Admin cannot delete themselves
  if (adminId === userId) {
    return NextResponse.json(
      { error: "Ne morete izbrisati lastnega računa." },
      { status: 400 },
    );
  }

  // Check target user exists
  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json(
      { error: "Uporabnik ne obstaja." },
      { status: 404 },
    );
  }

  // Delete from Supabase Auth (cascades to users table via DB trigger/FK)
  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("DELETE /api/users/[userId] error:", deleteError);
    return NextResponse.json(
      { error: "Napaka pri brisanju uporabnika." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Uporabnik je bil uspešno izbrisan." });
}