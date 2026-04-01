import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; postId: string }>;
};

// DELETE /api/projects/[projectId]/wall/[postId]
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId, postId } = await context.params;

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
      return NextResponse.json({ error: "Only the Scrum Master can delete wall posts." }, { status: 403 });
    }

    // Check post exists
    const { data: post } = await supabase
      .from("project_wall_posts")
      .select("id")
      .eq("id", postId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    // Delete post — comments are deleted automatically via cascade
    const { error } = await supabase
      .from("project_wall_posts")
      .delete()
      .eq("id", postId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Post deleted successfully." });
  } catch {
    return NextResponse.json({ error: "Error deleting post." }, { status: 500 });
  }
}