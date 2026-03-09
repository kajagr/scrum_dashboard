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
    const storyIds: string[] = body.storyIds;

    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return NextResponse.json(
        { error: "storyIds mora biti neprazen seznam." },
        { status: 400 },
      );
    }

    const today = getTodayDateString();

    // najdi aktivni sprint
    const { data: activeSprint, error: sprintError } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", projectId)
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();

    if (sprintError) {
      return NextResponse.json({ error: sprintError.message }, { status: 500 });
    }

    if (!activeSprint) {
      return NextResponse.json(
        { error: "Aktivni sprint ne obstaja." },
        { status: 400 },
      );
    }

    // preberi izbrane zgodbe
    const { data: stories, error: storiesError } = await supabase
      .from("user_stories")
      .select("id, project_id, status, sprint_id, story_points")
      .in("id", storyIds)
      .eq("project_id", projectId);

    if (storiesError) {
      return NextResponse.json(
        { error: storiesError.message },
        { status: 500 },
      );
    }

    if (!stories || stories.length !== storyIds.length) {
      return NextResponse.json(
        { error: "Nekatere zgodbe ne obstajajo ali ne pripadajo projektu." },
        { status: 400 },
      );
    }

    // validacije
    const invalidDone = stories.find((story) => story.status === "done");
    if (invalidDone) {
      return NextResponse.json(
        { error: "Realiziranih zgodb ni mogoče dodeliti sprintu." },
        { status: 400 },
      );
    }

    const alreadyAssignedToActive = stories.find(
      (story) => story.sprint_id === activeSprint.id,
    );
    if (alreadyAssignedToActive) {
      return NextResponse.json(
        { error: "Nekatere zgodbe so že dodeljene aktivnemu sprintu." },
        { status: 400 },
      );
    }

    // update vseh izbranih zgodb
    const { error: updateError } = await supabase
      .from("user_stories")
      .update({ sprint_id: activeSprint.id })
      .in("id", storyIds)
      .eq("project_id", projectId);

    if (updateError) {
      if (
        updateError.message.toLowerCase().includes("row-level security") ||
        updateError.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za dodeljevanje zgodb sprintu." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Zgodbe uspešno dodeljene aktivnemu sprintu.",
        sprint: activeSprint,
        assignedCount: storyIds.length,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Napaka pri dodeljevanju zgodb sprintu." },
      { status: 500 },
    );
  }
}
