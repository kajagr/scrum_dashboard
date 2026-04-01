import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

// GET /api/projects/:projectId/documentation/export?format=md|txt
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
