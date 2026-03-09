import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const storyIds: string[] = body.storyIds;

    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return NextResponse.json(
        { error: "storyIds must be a non-empty array." },
        { status: 400 }
      );
    }

    const today = getTodayDateString();

    // Find active sprint
    const { data: activeSprint, error: sprintError } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date, velocity")
      .eq("project_id", projectId)
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();

    if (sprintError) {
      return NextResponse.json({ error: sprintError.message }, { status: 500 });
    }

    if (!activeSprint) {
      return NextResponse.json(
        { error: "No active sprint exists for this project." },
        { status: 400 }
      );
    }

    // Fetch selected stories
    const { data: stories, error: storiesError } = await supabase
      .from("user_stories")
      .select("id, project_id, status, sprint_id, story_points")
      .in("id", storyIds)
      .eq("project_id", projectId);

    if (storiesError) {
      return NextResponse.json({ error: storiesError.message }, { status: 500 });
    }

    if (!stories || stories.length !== storyIds.length) {
      return NextResponse.json(
        { error: "Some stories do not exist or do not belong to this project." },
        { status: 400 }
      );
    }

    // Validate: velocity not exceeded
    if (activeSprint.velocity != null) {
      const { data: alreadyInSprint } = await supabase
        .from("user_stories")
        .select("story_points")
        .eq("sprint_id", activeSprint.id)
        .eq("project_id", projectId);

      const usedPoints = (alreadyInSprint ?? []).reduce((sum, s) => sum + (s.story_points ?? 0), 0);
      const incomingPoints = stories.reduce((sum, s) => sum + (s.story_points ?? 0), 0);

      if (usedPoints + incomingPoints > activeSprint.velocity) {
        return NextResponse.json(
          {
            error: `Adding these stories (${incomingPoints} pts) would exceed the sprint velocity of ${activeSprint.velocity} pts. Currently ${usedPoints} pts are assigned.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate: no story points missing
    const missingPoints = stories.find((s) => s.story_points == null);
    if (missingPoints) {
      return NextResponse.json(
        { error: "All stories must have story points set before being assigned to a sprint." },
        { status: 400 }
      );
    }

    // Validate: none are done
    const invalidDone = stories.find((s) => s.status === "done");
    if (invalidDone) {
      return NextResponse.json(
        { error: "Completed stories cannot be assigned to a sprint." },
        { status: 400 }
      );
    }

    // Validate: none already in the active sprint
    const alreadyAssigned = stories.find((s) => s.sprint_id === activeSprint.id);
    if (alreadyAssigned) {
      return NextResponse.json(
        { error: "Some stories are already assigned to the active sprint." },
        { status: 400 }
      );
    }

    // Assign all selected stories to the active sprint
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
          { error: "You don't have permission to assign stories to a sprint." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: `Successfully assigned ${storyIds.length} stor${storyIds.length === 1 ? "y" : "ies"} to sprint "${activeSprint.name}".`,
        sprint: activeSprint,
        assignedCount: storyIds.length,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "An error occurred while assigning stories to the sprint." },
      { status: 500 }
    );
  }
}