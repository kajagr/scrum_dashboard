import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { ProjectRole } from "@/lib/types";

type RouteContext = {
  params: Promise<{ projectId: string; userId: string }>;
};

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_ROLES: ProjectRole[] = [
  "product_owner",
  "scrum_master",
  "developer",
];

async function getCallerPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callerId: string,
  projectId: string,
): Promise<{ allowed: boolean }> {
  const [{ data: membership }, { data: userData }] = await Promise.all([
    supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", callerId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("system_role")
      .eq("id", callerId)
      .maybeSingle(),
  ]);

  const isAdmin = userData?.system_role === "admin";
  const isPrivileged = ["scrum_master", "product_owner"].includes(
    membership?.role ?? "",
  );

  return { allowed: isAdmin || isPrivileged };
}

/**
 * @swagger
 * /api/projects/{projectId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a project
 *     description: >
 *       Removes a user from the project.
 *       Only Scrum Masters, Product Owners, or system admins can remove members.
 *     tags:
 *       - Members
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user to remove
 *         example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *     responses:
 *       200:
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Member removed successfully."
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
 *         description: User does not have permission to manage members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You don't have permission to manage members of this project."
 *       404:
 *         description: Member not found in this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Member not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error removing member."
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId, userId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { allowed } = await getCallerPermission(supabase, user.id, projectId);
    if (!allowed)
      return NextResponse.json(
        { error: "You don't have permission to manage members of this project." },
        { status: 403 },
      );

    const { data: targetMember } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!targetMember)
      return NextResponse.json({ error: "Member not found." }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ message: "Member removed successfully." });
  } catch {
    return NextResponse.json(
      { error: "Error removing member." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/projects/{projectId}/members/{userId}:
 *   patch:
 *     summary: Update a member's project role
 *     description: >
 *       Updates the project role of a member.
 *       Only Scrum Masters, Product Owners, or system admins can change roles.
 *     tags:
 *       - Members
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user whose role to update
 *         example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [product_owner, scrum_master, developer]
 *                 example: "scrum_master"
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Role updated successfully."
 *       400:
 *         description: Invalid or missing role value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid role. Valid roles are: product_owner, scrum_master, developer"
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
 *         description: User does not have permission to manage members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You don't have permission to manage members of this project."
 *       404:
 *         description: Member not found in this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Member not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error updating member role."
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId, userId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { allowed } = await getCallerPermission(supabase, user.id, projectId);
    if (!allowed)
      return NextResponse.json(
        { error: "You don't have permission to manage members of this project." },
        { status: 403 },
      );

    const body = await request.json();
    const { role: newRole } = body;

    if (!newRole || !VALID_ROLES.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Valid roles are: ${VALID_ROLES.join(", ")}` },
        { status: 400 },
      );
    }

    const { data: targetMember } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!targetMember)
      return NextResponse.json({ error: "Member not found." }, { status: 404 });

    const { error: updateError } = await supabaseAdmin
      .from("project_members")
      .update({ role: newRole })
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ message: "Role updated successfully." });
  } catch {
    return NextResponse.json(
      { error: "Error updating member role." },
      { status: 500 },
    );
  }
}