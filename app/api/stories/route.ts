import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_PRIORITIES = ["must_have", "should_have", "could_have", "wont_have"] as const;

// GET /api/stories?projectId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("user_stories")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/stories
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { project_id, title, description, acceptance_criteria, priority, story_points, business_value } = body;

  // Obvezna polja
  if (!project_id || !title?.trim()) {
    return NextResponse.json({ error: "project_id in title sta obvezni." }, { status: 400 });
  }

  if (business_value === undefined || business_value === null || business_value === "") {
    return NextResponse.json({ error: "business_value je obvezen." }, { status: 400 });
  }

  // Validacija prioritete
  const finalPriority = priority || "should_have";
  if (!ALLOWED_PRIORITIES.includes(finalPriority)) {
    return NextResponse.json({ error: "Neveljavna prioriteta." }, { status: 400 });
  }

  // Validacija business_value
  const bv = Number(business_value);
  if (!Number.isFinite(bv) || bv < 1 || bv > 100) {
    return NextResponse.json({ error: "business_value mora biti med 1 in 100." }, { status: 400 });
  }

  // Validacija story_points
  let spNumber: number | null = null;
  if (story_points !== null && story_points !== undefined && story_points !== "") {
    spNumber = Number(story_points);
    if (!Number.isFinite(spNumber) || spNumber < 0) {
      return NextResponse.json({ error: "story_points mora biti 0 ali več." }, { status: 400 });
    }
  }

  // Preveri podvajanje naslova znotraj projekta
  const { data: existing } = await supabase
    .from("user_stories")
    .select("id")
    .eq("project_id", project_id)
    .eq("title", title.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "User story s tem naslovom že obstaja v tem projektu." },
      { status: 409 }
    );
  }

  // Naslednja pozicija
  const { data: lastStory } = await supabase
    .from("user_stories")
    .select("position")
    .eq("project_id", project_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = lastStory ? lastStory.position + 1 : 0;

  const { data, error } = await supabase
    .from("user_stories")
    .insert({
      project_id,
      title: title.trim(),
      description: description?.trim() || null,
      acceptance_criteria: acceptance_criteria?.trim() || null,
      priority: finalPriority,
      story_points: spNumber,
      business_value: bv,
      status: "backlog",
      position: nextPosition,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("permission denied")) {
      return NextResponse.json({ error: "Nimaš pravic za ustvarjanje user story." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}