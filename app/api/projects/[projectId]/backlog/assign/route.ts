import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

/**
 * @swagger
 * /api/projects/{projectId}/backlog/assign:
 *   post:
 *     summary: Assign stories to active sprint
 *     description: >
 *       Assigns one or more user stories from the backlog to the currently active sprint.
 *       Validates that stories exist, belong to the project, have story points set,
 *       are not already done, are not already in the active sprint,
 *       and that the sprint velocity would not be exceeded.
 *     tags:
 *       - Backlog
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storyIds
 *             properties:
 *               storyIds:
 *                 type: array
 *                 description: List of user story IDs to assign to the active sprint
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["c3d4e5f6-a7b8-9012-cdef-123456789012", "d4e5f6a7-b8c9-0123-defa-234567890123"]
 *     responses:
 *       200:
 *         description: Stories successfully assigned to the active sprint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully assigned 2 stories to sprint \"Sprint 1\"."
 *                 sprint:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *                     name:
 *                       type: string
 *                       example: "Sprint 1"
 *                     start_date:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-01"
 *                     end_date:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-14"
 *                     velocity:
 *                       type: integer
 *                       example: 21
 *                 assignedCount:
 *                   type: integer
 *                   example: 2
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     emptyArray:
 *                       value: "storyIds must be a non-empty array."
 *                     noActiveSprint:
 *                       value: "No active sprint exists for this project."
 *                     notFound:
 *                       value: "Some stories do not exist or do not belong to this project."
 *                     velocityExceeded:
 *                       value: "Adding these stories (8 pts) would exceed the sprint velocity of 21 pts. Currently 15 pts are assigned."
 *                     missingPoints:
 *                       value: "All stories must have story points set before being assigned to a sprint."
 *                     alreadyDone:
 *                       value: "Completed stories cannot be assigned to a sprint."
 *                     alreadyAssigned:
 *                       value: "Some stories are already assigned to the active sprint."
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: User does not have permission to assign stories to a sprint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You don't have permission to assign stories to a sprint."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An error occurred while assigning stories to the sprint."
 */
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
        { error: "storyIds must be a non-empty array." },
        { status: 400 },
      );
    }

    const today = getTodayDateString();

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
        { status: 400 },
      );
    }

    const { data: stories, error: storiesError } = await supabase
      .from("user_stories")
      .select("id, project_id, status, sprint_id, story_points")
      .in("id", storyIds)
      .eq("project_id", projectId)
      .is("deleted_at", null);

    if (storiesError) {
      return NextResponse.json(
        { error: storiesError.message },
        { status: 500 },
      );
    }

    if (!stories || stories.length !== storyIds.length) {
      return NextResponse.json(
        {
          error: "Some stories do not exist or do not belong to this project.",
        },
        { status: 400 },
      );
    }

    if (activeSprint.velocity != null) {
      const { data: alreadyInSprint } = await supabase
        .from("user_stories")
        .select("story_points")
        .eq("sprint_id", activeSprint.id)
        .eq("project_id", projectId)
        .is("deleted_at", null);

      const usedPoints = (alreadyInSprint ?? []).reduce(
        (sum, s) => sum + (s.story_points ?? 0),
        0,
      );
      const incomingPoints = stories.reduce(
        (sum, s) => sum + (s.story_points ?? 0),
        0,
      );

      if (usedPoints + incomingPoints > activeSprint.velocity) {
        return NextResponse.json(
          {
            error: `Adding these stories (${incomingPoints} pts) would exceed the sprint velocity of ${activeSprint.velocity} pts. Currently ${usedPoints} pts are assigned.`,
          },
          { status: 400 },
        );
      }
    }

    const missingPoints = stories.find((s) => s.story_points == null);
    if (missingPoints) {
      return NextResponse.json(
        {
          error:
            "All stories must have story points set before being assigned to a sprint.",
        },
        { status: 400 },
      );
    }

    const invalidDone = stories.find((s) => s.status === "done");
    if (invalidDone) {
      return NextResponse.json(
        { error: "Completed stories cannot be assigned to a sprint." },
        { status: 400 },
      );
    }

    const alreadyAssigned = stories.find(
      (s) => s.sprint_id === activeSprint.id,
    );
    if (alreadyAssigned) {
      return NextResponse.json(
        { error: "Some stories are already assigned to the active sprint." },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("user_stories")
      .update({ sprint_id: activeSprint.id, status: "in_progress" })
      .in("id", storyIds)
      .eq("project_id", projectId);

    if (updateError) {
      if (
        updateError.message.toLowerCase().includes("row-level security") ||
        updateError.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "You don't have permission to assign stories to a sprint." },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Record sprint assignment history
    const historyRows = storyIds.map((id) => ({
      user_story_id: id,
      sprint_id: activeSprint.id,
      assigned_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("story_sprint_history").insert(historyRows);

    return NextResponse.json(
      {
        message: `Successfully assigned ${storyIds.length} stor${storyIds.length === 1 ? "y" : "ies"} to sprint "${activeSprint.name}".`,
        sprint: activeSprint,
        assignedCount: storyIds.length,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "An error occurred while assigning stories to the sprint." },
      { status: 500 },
    );
  }
}
