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

// GET /api/projects/:projectId/documentation
// Returns current documentation content. If none exists yet, returns empty string.
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check membership
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

    // No doc yet — return empty
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

// PUT /api/projects/:projectId/documentation
// Upserts the documentation content for a project.
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check membership
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

    // Upsert — insert on first save, update on subsequent saves
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
