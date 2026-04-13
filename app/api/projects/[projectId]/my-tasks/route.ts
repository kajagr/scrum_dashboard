import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const supabase = await createClient();
  const { projectId } = await context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all tasks assigned to the current user in this project,
  // via user_stories that belong to the project
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, remaining_time, user_story:user_stories!inner(id, title, status, project_id)",
    )
    .eq("assignee_id", user.id)
    .eq("user_story.project_id", projectId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
