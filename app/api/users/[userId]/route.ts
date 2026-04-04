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
 *       Username and email must be unique (case-insensitive) across all active users, excluding the target user.
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
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Caller is not an administrator
 *       404:
 *         description: Target user not found
 *       409:
 *         description: Username or email already in use
 *       500:
 *         description: Internal server error
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

  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json(
      { error: "Uporabnik ne obstaja." },
      { status: 404 },
    );
  }

  const [{ data: duplicateUsername }, { data: duplicateEmail }] =
    await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id")
        .ilike("username", username)
        .neq("id", userId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id")
        .ilike("email", email)
        .neq("id", userId)
        .is("deleted_at", null)
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
 *     summary: Soft delete a user (admin only)
 *     description: >
 *       Soft deletes a user — sets deleted_at, bans them in Supabase Auth,
 *       removes them from all project_members, and unassigns their tasks.
 *       Historical data (time logs, comments, etc.) is preserved for reporting.
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
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Caller is not an administrator
 *       404:
 *         description: Target user not found
 *       500:
 *         description: Internal server error
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { adminId, error: authError } = await requireAdmin();
  if (authError) return authError;

  const { userId } = await params;

  if (adminId === userId) {
    return NextResponse.json(
      { error: "Ne morete izbrisati lastnega računa." },
      { status: 400 },
    );
  }

  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json(
      { error: "Uporabnik ne obstaja." },
      { status: 404 },
    );
  }

  // 1. Soft delete — set deleted_at
  const { error: softDeleteError } = await supabaseAdmin
    .from("users")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);

  if (softDeleteError) {
    console.error("DELETE /api/users/[userId] soft delete error:", softDeleteError);
    return NextResponse.json(
      { error: "Napaka pri brisanju uporabnika." },
      { status: 500 },
    );
  }

  // 2. Ban in Supabase Auth so they can't log in
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { ban_duration: "876600h" }, // 100 years
  );

  if (banError) {
    console.error("DELETE /api/users/[userId] ban error:", banError);
    // Non-fatal — user is already soft deleted in our DB
  }

  // 3. Remove from all projects
  await supabaseAdmin
    .from("project_members")
    .delete()
    .eq("user_id", userId);

  // 4. Unassign their tasks (preserve task history, just clear assignee)
  await supabaseAdmin
    .from("tasks")
    .update({
      assignee_id: null,
      is_accepted: false,
      status: "unassigned",
    })
    .eq("assignee_id", userId)
    .is("deleted_at", null)
    .neq("status", "completed");

  return NextResponse.json({ message: "Uporabnik je bil uspešno izbrisan." });
}