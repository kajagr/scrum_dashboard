import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["active", "on_hold", "completed"] as const;
type ProjectStatus = (typeof VALID_STATUSES)[number];

// PATCH /api/projects/[projectId] - Update project status
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

  // Check user role in project
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  // Also allow system admins to change status
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