import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

// GET /api/stories/:storyId/comments
// Vrne vse komentarje zgodbe z avtorjem, sortirano po created_at ASC
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Preveri da je zgodba veljavna in pridobi project_id
    const { data: story } = await supabase
      .from("user_stories")
      .select("id, project_id")
      .eq("id", storyId)
      .maybeSingle();

    if (!story)
      return NextResponse.json({ error: "Story not found." }, { status: 404 });

    // Preveri članstvo
    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership)
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 },
      );

    const { data: comments, error } = await supabase
      .from("story_comments")
      .select(
        `
        id,
        content,
        created_at,
        author:users(id, first_name, last_name, username)
      `,
      )
      .eq("user_story_id", storyId)
      .order("created_at", { ascending: true });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(comments ?? []);
  } catch {
    return NextResponse.json(
      { error: "Error fetching comments." },
      { status: 500 },
    );
  }
}

// POST /api/stories/:storyId/comments
// Doda nov komentar k zgodbi
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Preveri da je zgodba veljavna in pridobi project_id
    const { data: story } = await supabase
      .from("user_stories")
      .select("id, project_id")
      .eq("id", storyId)
      .maybeSingle();

    if (!story)
      return NextResponse.json({ error: "Story not found." }, { status: 404 });

    // Preveri članstvo
    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership)
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 },
      );

    const body = await req.json();
    const content = body.content?.trim();

    if (!content)
      return NextResponse.json(
        { error: "Comment content cannot be empty." },
        { status: 400 },
      );

    const { data: comment, error } = await supabase
      .from("story_comments")
      .insert({ user_story_id: storyId, user_id: user.id, content })
      .select(
        `
        id,
        content,
        created_at,
        author:users(id, first_name, last_name, username)
      `,
      )
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error adding comment." },
      { status: 500 },
    );
  }
}
