import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * @swagger
 * /api/projects/{projectId}/documentation/export:
 *   get:
 *     summary: Export project documentation as a file
 *     description: >
 *       Downloads the project documentation as a .md or .txt file.
 *       Only project members can export documentation.
 *       If no documentation exists yet, an empty file is returned.
 *       PDF export is handled directly on the frontend using the browser's built-in print functionality and is not available via this endpoint.
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
 *       - in: query
 *         name: format
 *         required: false
 *         schema:
 *           type: string
 *           enum: [md, txt]
 *           default: md
 *         description: The file format to export. Defaults to md.
 *         example: "md"
 *     responses:
 *       200:
 *         description: File download response
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: "attachment; filename=\"documentation.md\""
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: "text/markdown; charset=utf-8"
 *         content:
 *           text/markdown:
 *             schema:
 *               type: string
 *               example: "## Sprint 1\nImplementirali smo avtentikacijo."
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "## Sprint 1\nImplementirali smo avtentikacijo."
 *       400:
 *         description: Unsupported export format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unsupported format. Use: md, txt"
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
 *                   example: "Error exporting documentation."
 */
export async function GET(req: NextRequest, context: RouteContext) {
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
      .select("content")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const content = data?.content ?? "";

    const format = req.nextUrl.searchParams.get("format") ?? "md";
    const allowedFormats = ["md", "txt"];

    if (!allowedFormats.includes(format))
      return NextResponse.json(
        { error: "Unsupported format. Use: md, txt" },
        { status: 400 },
      );

    const mimeType = format === "md" ? "text/markdown" : "text/plain";
    const filename = `documentation.${format}`;

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": `${mimeType}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error exporting documentation." },
      { status: 500 },
    );
  }
}
