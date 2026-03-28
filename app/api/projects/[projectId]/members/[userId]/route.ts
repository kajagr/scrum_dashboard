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

// ─── Helper: check if caller has permission to manage members ─────────────────
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
        {
          error: "You don't have permission to manage members of this project.",
        },
        { status: 403 },
      );

    // Check target member exists
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
        {
          error: "You don't have permission to manage members of this project.",
        },
        { status: 403 },
      );

    const body = await request.json();
    const { role: newRole } = body;

    if (!newRole || !VALID_ROLES.includes(newRole)) {
      return NextResponse.json(
        {
          error: `Invalid role. Valid roles are: ${VALID_ROLES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Check target member exists
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
