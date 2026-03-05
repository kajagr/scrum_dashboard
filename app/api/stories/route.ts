import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/stories?projectId=xxx - Fetch stories for a project
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_stories")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/stories - Create a new user story
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, title, description, acceptance_criteria, priority, story_points } = body;

  if (!project_id || !title) {
    return NextResponse.json({ error: "project_id and title are required" }, { status: 400 });
  }

  // Get max position
  const { data: stories } = await supabase
    .from("user_stories")
    .select("position")
    .eq("project_id", project_id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = stories && stories.length > 0 ? stories[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("user_stories")
    .insert({
      project_id,
      title,
      description,
      acceptance_criteria,
      priority: priority || "should_have",
      story_points,
      status: "backlog",
      position: nextPosition,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}