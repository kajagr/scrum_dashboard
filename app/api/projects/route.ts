import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canCreateProject, projectNameExists } from "@/lib/permissions";

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     description: Returns all projects for the currently authenticated user, ordered by creation date descending.
 *     tags:
 *       - Projects
 *     responses:
 *       200:
 *         description: List of projects
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
 *                     example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                   name:
 *                     type: string
 *                     example: "Scrum App"
 *                   description:
 *                     type: string
 *                     example: "A project management application."
 *                   owner_id:
 *                     type: string
 *                     format: uuid
 *                     example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
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
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admini vidijo vse projekte
  const { data: userData } = await supabase
    .from("users")
    .select("system_role")
    .eq("id", user.id)
    .single();

  if (userData?.system_role === "admin") {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Navadni userji vidijo samo projekte kjer so aktivni člani (removed_at IS NULL)
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_members!inner(user_id, removed_at)")
    .eq("project_members.user_id", user.id)
    .is("project_members.removed_at", null)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Odstrani project_members iz response (frontend jih ne potrebuje)
  return NextResponse.json(data.map(({ project_members: _, ...p }) => p));
}

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     description: Creates a new project. Only administrators can create projects. The creator is automatically added as product_owner.
 *     tags:
 *       - Projects
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
 *                 example: "Scrum App"
 *               description:
 *                 type: string
 *                 example: "A project management application."
 *               members:
 *                 type: array
 *                 description: Optional list of members to add to the project
 *                 items:
 *                   type: object
 *                   required:
 *                     - user_id
 *                     - role
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                       example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                     role:
 *                       type: string
 *                       enum: [product_owner, scrum_master, dev]
 *                       example: "dev"
 *     responses:
 *       201:
 *         description: Project created successfully
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
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Missing project name or duplicate name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missingName:
 *                       value: "Project name is required"
 *                     duplicateName:
 *                       value: "A project with this name already exists"
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
 *                   example: "Only an administrator can create a project"
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
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCreate = await canCreateProject(user.id);
  if (!canCreate) {
    return NextResponse.json(
      { error: "Only an administrator can create a project" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, description, members } = body;

  if (!name) {
    return NextResponse.json(
      { error: "Project name is required" },
      { status: 400 },
    );
  }

  const nameExists = await projectNameExists(name);
  if (nameExists) {
    return NextResponse.json(
      { error: "A project with this name already exists" },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      owner_id: user.id,
    })
    .select()
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  return NextResponse.json(project, { status: 201 });
}
