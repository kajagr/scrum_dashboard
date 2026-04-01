import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; postId: string; commentId: string }>;
};

// DELETE /api/projects/[projectId]/wall/[postId]/comments/[commentId]
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId, commentId } = await context.params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check membership — only scrum_master can delete
    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    }

    if (membership.role !== "scrum_master") {
      return NextResponse.json({ error: "Only the Scrum Master can delete comments." }, { status: 403 });
    }

    // Check comment exists
    const { data: comment } = await supabase
      .from("post_comments")
      .select("id")
      .eq("id", commentId)
      .maybeSingle();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    }

    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Comment deleted successfully." });
  } catch {
    return NextResponse.json({ error: "Error deleting comment." }, { status: 500 });
  }
}