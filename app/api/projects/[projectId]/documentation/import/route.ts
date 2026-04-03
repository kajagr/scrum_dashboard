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
 * /api/projects/{projectId}/documentation/import:
 *   post:
 *     summary: Import documentation from a file
 *     description: >
 *       Accepts a .md or .txt file upload and replaces the project's documentation content (upsert).
 *       Only project members can import documentation.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: A .md or .txt file whose content will replace the current documentation
 *     responses:
 *       200:
 *         description: Documentation imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Documentation imported successfully."
 *                 content:
 *                   type: string
 *                   description: The imported content
 *                   example: "## Sprint 1\nImplementirali smo avtentikacijo."
 *       400:
 *         description: Missing file or unsupported file format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     noFile:
 *                       value: "No file provided."
 *                     wrongFormat:
 *                       value: "Unsupported file format. Upload a .md or .txt file."
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
 *                   example: "Error importing documentation."
 */
export async function POST(req: NextRequest, context: RouteContext) {
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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const allowedTypes = ["text/markdown", "text/plain"];
    const allowedExtensions = [".md", ".txt"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      return NextResponse.json(
        { error: "Unsupported file format. Upload a .md or .txt file." },
        { status: 400 },
      );
    }

    const content = await file.text();

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

    return NextResponse.json({
      message: "Documentation imported successfully.",
      content,
    });
  } catch {
    return NextResponse.json(
      { error: "Error importing documentation." },
      { status: 500 },
    );
  }
}
