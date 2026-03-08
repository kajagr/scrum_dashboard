import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

const ALLOWED_PRIORITIES = [
  "must_have",
  "should_have",
  "could_have",
  "wont_have",
] as const;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const acceptanceCriteria = body.acceptance_criteria?.trim() || null;
    const priority = body.priority;
    const businessValue = body.business_value;
    const storyPoints = body.story_points ?? null;

    //preverjanje obveznih polj
    if (
      !title ||
      !priority ||
      businessValue === undefined ||
      businessValue === null
    ) {
      return NextResponse.json(
        { error: "title, priority in business_value so obvezni." },
        { status: 400 },
      );
    }

    //preverjanje pravilnosti prioritete
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: "Neveljavna prioriteta." },
        { status: 400 },
      );
    }

    const businessValueNumber = Number(businessValue);

    //preverjanje pravilnosti business_value
    if (
      !Number.isFinite(businessValueNumber) ||
      businessValueNumber <= 0 ||
      businessValueNumber > 100
    ) {
      return NextResponse.json(
        { error: "business_value mora biti med 1 in 100." },
        { status: 400 },
      );
    }

    let storyPointsNumber: number | null = null;

    //preverjanje pravilnosti story_points
    if (storyPoints !== null && storyPoints !== "") {
      storyPointsNumber = Number(storyPoints);

      if (!Number.isFinite(storyPointsNumber) || storyPointsNumber < 0) {
        return NextResponse.json(
          { error: "story_points mora biti 0 ali več." },
          { status: 400 },
        );
      }
    }

    //poda nov story na pravo mesto (backlog se sortira po position)
    const { data: existingStory, error: duplicateCheckError } = await supabase
      .from("user_stories")
      .select("id")
      .eq("project_id", projectId)
      .eq("title", title)
      .maybeSingle();

    if (duplicateCheckError) {
      return NextResponse.json(
        { error: duplicateCheckError.message },
        { status: 500 },
      );
    }

    if (existingStory) {
      return NextResponse.json(
        { error: "User story s tem naslovom že obstaja." },
        { status: 409 },
      );
    }

    const { data: lastStory, error: lastStoryError } = await supabase
      .from("user_stories")
      .select("position")
      .eq("project_id", projectId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastStoryError) {
      return NextResponse.json(
        { error: lastStoryError.message },
        { status: 500 },
      );
    }

    const nextPosition = lastStory ? lastStory.position + 1 : 0;

    const { data, error } = await supabase
      .from("user_stories")
      .insert({
        project_id: projectId,
        title,
        description,
        acceptance_criteria: acceptanceCriteria,
        priority,
        business_value: businessValueNumber,
        story_points: storyPointsNumber,
        status: "backlog",
        position: nextPosition,
        created_by: user.id,
      })
      .select()
      .single();

    //preveri RLS pravila (le PO in SM lahko dodajata story)
    if (error) {
      if (
        error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za ustvarjanje user story." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri ustvarjanju user story." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
      error: useError,
    } = await supabase.auth.getUser();

    if (useError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_stories")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true });

    if (error) {
      if (
        error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za ogled user stories." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju user stories." },
      { status: 500 },
    );
  }
}
