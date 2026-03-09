import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    const today = getTodayDateString();

    const { data: activeSprint, error: activeSprintError } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date, status")
      .eq("project_id", projectId)
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();

    if (activeSprintError) {
      return NextResponse.json(
        { error: activeSprintError.message },
        { status: 500 },
      );
    }

    const { data: stories, error: storiesError } = await supabase
      .from("user_stories")
      .select(
        `
        id,
        title,
        description,
        acceptance_criteria,
        priority,
        business_value,
        story_points,
        status,
        sprint_id,
        position,
        created_at,
        updated_at
      `,
      )
      .eq("project_id", projectId)
      .order("position", { ascending: true });

    if (storiesError) {
      return NextResponse.json(
        { error: storiesError.message },
        { status: 500 },
      );
    }

    const realized = (stories ?? []).filter((story) => story.status === "done");

    const assigned = (stories ?? []).filter(
      (story) =>
        story.status !== "done" &&
        activeSprint &&
        story.sprint_id === activeSprint.id,
    );

    const unassigned = (stories ?? []).filter(
      (story) =>
        story.status !== "done" &&
        (!activeSprint ||
          !story.sprint_id ||
          story.sprint_id !== activeSprint.id),
    );

    return NextResponse.json(
      {
        activeSprint: activeSprint ?? null,
        realized,
        assigned,
        unassigned,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju product backloga." },
      { status: 500 },
    );
  }
}
