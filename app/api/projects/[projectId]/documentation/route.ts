import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * @swagger
 * /api/projects/{projectId}/documentation:
 *   get:
 *     summary: Get project documentation
 *     description: >
 *       Returns the current documentation content for a project.
 *       If no documentation has been saved yet, returns an empty content string.
 *       Only project members can view documentation.
 *     tags:
 *       - Documentation
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
 *         description: Documentation retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                   description: Markdown content of the documentation. Empty string if none exists yet.
 *                   example: "## Sprint 1\nImplementirali smo avtentikacijo."
 *                 updated_by:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *                   description: ID of the user who last updated the documentation
 *                   example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                 updated_at:
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
 *       403:
 *         description: User is not a member of this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You are not a member of this project."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error fetching documentation."
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership)
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 },
      );

    const { data, error } = await supabase
      .from("project_documentation")
      .select("content, updated_by, updated_at")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data)
      return NextResponse.json({
        content: "",
        updated_by: null,
        updated_at: null,
      });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Error fetching documentation." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/projects/{projectId}/documentation:
 *   put:
 *     summary: Save project documentation
 *     description: >
 *       Creates or updates the documentation for a project (upsert).
 *       On first save, a new documentation record is created.
 *       On subsequent saves, the existing record is updated.
 *       Only project members can save documentation.
 *     tags:
 *       - Documentation
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Markdown content to save. Defaults to empty string if not provided.
 *                 example: "## Sprint 1\nImplementirali smo avtentikacijo."
 *     responses:
 *       200:
 *         description: Documentation saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Documentation saved successfully."
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
 *         description: User is not a member of this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You are not a member of this project."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error saving documentation."
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership)
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 },
      );

    const body = await req.json();
    const content: string = body.content ?? "";

    const { error } = await supabaseAdmin.from("project_documentation").upsert(
      {
        project_id: projectId,
        content,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ message: "Documentation saved successfully." });
  } catch {
    return NextResponse.json(
      { error: "Error saving documentation." },
      { status: 500 },
    );
  }
}