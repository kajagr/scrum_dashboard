import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["active", "on_hold", "completed"] as const;
type ProjectStatus = (typeof VALID_STATUSES)[number];

/**
 * @swagger
 * /api/projects/{projectId}:
 *   patch:
 *     summary: Update project status
 *     description: Updates the status of a project. Only Scrum Masters, Product Owners, or system admins can change the status.
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project to update
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, on_hold, completed]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Project status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                 name:
 *                   type: string
 *                   example: "Scrum App"
 *                 description:
 *                   type: string
 *                   example: "A project management application."
 *                 owner_id:
 *                   type: string
 *                   format: uuid
 *                   example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                 status:
 *                   type: string
 *                   enum: [active, on_hold, completed]
 *                   example: "active"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Invalid or missing status value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid status. Allowed: active, on_hold, completed"
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
 *         description: User does not have permission to change project status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Only Scrum Masters, Product Owners or admins can change project status."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unexpected error occurred."
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const body = await req.json();
  const { status } = body;

  if (!status || !VALID_STATUSES.includes(status as ProjectStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  const { data: userData } = await supabase
    .from("users")
    .select("system_role")
    .eq("id", user.id)
    .single();

  const isAdmin = userData?.system_role === "admin";
  const canEdit = isAdmin || ["scrum_master", "product_owner"].includes(membership?.role ?? "");

  if (!canEdit) {
    return NextResponse.json(
      { error: "Only Scrum Masters, Product Owners or admins can change project status." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    console.error("PATCH /projects/[projectId] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}