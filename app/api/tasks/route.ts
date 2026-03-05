import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/tasks?storyId=xxx - Fetch tasks for a user story
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId");

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!storyId) {
    return NextResponse.json({ error: "storyId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_story_id", storyId)
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { user_story_id, title, description, estimated_hours } = body;

  if (!user_story_id || !title) {
    return NextResponse.json({ error: "user_story_id and title are required" }, { status: 400 });
  }

  // Get max position
  const { data: tasks } = await supabase
    .from("tasks")
    .select("position")
    .eq("user_story_id", user_story_id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = tasks && tasks.length > 0 ? tasks[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_story_id,
      title,
      description,
      estimated_hours,
      status: "todo",
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}