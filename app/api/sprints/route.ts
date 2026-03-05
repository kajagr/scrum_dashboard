import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/sprints?projectId=xxx - Fetch sprints for a project
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
    .from("sprints")
    .select("*")
    .eq("project_id", projectId)
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/sprints - Create a new sprint
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, name, goal, start_date, end_date } = body;

  if (!project_id || !name || !start_date || !end_date) {
    return NextResponse.json(
      { error: "project_id, name, start_date and end_date are required" },
      { status: 400 }
    );
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return NextResponse.json(
      { error: "end_date must be after start_date" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("sprints")
    .insert({
      project_id,
      name,
      goal,
      start_date,
      end_date,
      status: "planned",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}