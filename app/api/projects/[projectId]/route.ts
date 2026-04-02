import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["active", "on_hold", "completed"] as const;
type ProjectStatus = (typeof VALID_STATUSES)[number];

/**
 * @swagger
 * /api/projects/{projectId}:
 *   get:
 *     summary: Get a single project
 *     description: Returns basic details of a project by ID.
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Project retrieved successfully
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
 *                   nullable: true
 *                   example: "A project management application."
 *                 status:
 *                   type: string
 *                   enum: [active, on_hold, completed]
 *                   example: "active"
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
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Project not found."
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, status")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data)
    return NextResponse.json({ error: "Project not found." }, { status: 404 });

  return NextResponse.json(data);
}

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
 *                   nullable: true
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
  { params }: { params: Promise<{ projectId: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const body = await req.json();
  const { status } = body;

  if (!status || !VALID_STATUSES.includes(status as ProjectStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
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
  const canEdit =
    isAdmin ||
    ["scrum_master", "product_owner"].includes(membership?.role ?? "");

  if (!canEdit) {
    return NextResponse.json(
      {
        error:
          "Only Scrum Masters, Product Owners or admins can change project status.",
      },
      { status: 403 },
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

/**
 * @swagger
 * /api/projects/{projectId}:
 *   put:
 *     summary: Update project name and description
 *     description: >
 *       Updates the name and description of a project.
 *       Only Scrum Masters, Product Owners, or system admins can edit the project.
 *       Project name must be unique (case-insensitive) across all projects.
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Must be unique (case-insensitive) across all projects
 *                 example: "Scrum App v2"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Updated project description."
 *     responses:
 *       200:
 *         description: Project updated successfully
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
 *                   example: "Scrum App v2"
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: "Updated project description."
 *                 status:
 *                   type: string
 *                   enum: [active, on_hold, completed]
 *                   example: "active"
 *                 owner_id:
 *                   type: string
 *                   format: uuid
 *                   example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Missing name field
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Name is required."
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
 *         description: User does not have permission to edit the project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No permission."
 *       409:
 *         description: A project with this name already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "A project with this name already exists."
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
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const body = await req.json();
  const name = body.name?.trim();
  if (!name)
    return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const [{ data: membership }, { data: userData }] = await Promise.all([
    supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("system_role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const canEdit =
    userData?.system_role === "admin" ||
    ["scrum_master", "product_owner"].includes(membership?.role ?? "");
  if (!canEdit)
    return NextResponse.json({ error: "No permission." }, { status: 403 });

  const { data: duplicate } = await supabase
    .from("projects")
    .select("id")
    .ilike("name", name)
    .neq("id", projectId)
    .maybeSingle();
  if (duplicate)
    return NextResponse.json(
      { error: "A project with this name already exists." },
      { status: 409 },
    );

  const { data, error } = await supabase
    .from("projects")
    .update({ name, description: body.description?.trim() || null })
    .eq("id", projectId)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}