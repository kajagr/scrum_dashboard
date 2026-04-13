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

function daysAgo(dateStr: string): number {
  const end = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * @swagger
 * /api/projects/{projectId}/backlog:
 *   get:
 *     summary: Get product backlog
 *     description: >
 *       Returns all user stories for a project, grouped into three categories:
 *       unassigned (not in active sprint), assigned (in active sprint, not done),
 *       and realized (done). Also returns the currently active sprint if one exists.
 *       Stories that were not confirmed or rejected before their sprint ended will
 *       include an `unfinished_sprint_info` field with the sprint name and days ago.
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
 *     responses:
 *       200:
 *         description: Product backlog data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activeSprint:
 *                   description: Currently active sprint, or null if none exists
 *                   oneOf:
 *                     - type: "null"
 *                     - type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *                         name:
 *                           type: string
 *                           example: "Sprint 1"
 *                         start_date:
 *                           type: string
 *                           format: date
 *                           example: "2024-01-01"
 *                         end_date:
 *                           type: string
 *                           format: date
 *                           example: "2024-01-14"
 *                         status:
 *                           type: string
 *                           example: "active"
 *                         velocity:
 *                           type: number
 *                           example: 21
 *                 realized:
 *                   type: array
 *                   description: Stories with status "done"
 *                   items:
 *                     $ref: '#/components/schemas/UserStory'
 *                 assigned:
 *                   type: array
 *                   description: Stories assigned to the active sprint, not yet done
 *                   items:
 *                     $ref: '#/components/schemas/UserStory'
 *                 unassigned:
 *                   type: array
 *                   description: Stories not assigned to the active sprint and not done
 *                   items:
 *                     $ref: '#/components/schemas/UserStory'
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error loading product backlog."
 *
 * components:
 *   schemas:
 *     UserStory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *         title:
 *           type: string
 *           example: "As a user, I want to log in"
 *         description:
 *           type: string
 *           example: "User should be able to log in with email and password."
 *         acceptance_criteria:
 *           type: string
 *           example: "Login form is visible. Error shown on wrong credentials."
 *         priority:
 *           type: string
 *           enum: [must_have, should_have, could_have, wont_have]
 *           example: "must_have"
 *         business_value:
 *           type: integer
 *           example: 10
 *         story_points:
 *           type: integer
 *           example: 3
 *         status:
 *           type: string
 *           enum: [todo, in_progress, done]
 *           example: "todo"
 *         sprint_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *         position:
 *           type: integer
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-16T08:00:00Z"
 *         unfinished_sprint_info:
 *           type: object
 *           nullable: true
 *           description: Present when the story was not confirmed/rejected before its sprint ended
 *           properties:
 *             sprint_name:
 *               type: string
 *               example: "Sprint 1"
 *             days_ago:
 *               type: integer
 *               example: 3
 */
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
      .select("id, name, start_date, end_date, status, velocity")
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

    // Fetch all sprints so we can attach sprint name/days info to unfinished stories
    const { data: allSprints } = await supabase
      .from("sprints")
      .select("id, name, end_date")
      .eq("project_id", projectId);

    const sprintMap: Record<string, { name: string; end_date: string }> = {};
    (allSprints ?? []).forEach((s) => {
      sprintMap[s.id] = { name: s.name, end_date: s.end_date };
    });

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
        realized_at,
        position,
        created_at,
        updated_at
      `,
      )
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (storiesError) {
      return NextResponse.json(
        { error: storiesError.message },
        { status: 500 },
      );
    }

    // Enrich stories that are stuck in an expired sprint with sprint info
    // Stories are NOT moved — they stay where they are, just get a label
    const enrichedStories = (stories ?? []).map((story) => {
      const isExpiredSprint =
        story.sprint_id &&
        story.status !== "done" &&
        sprintMap[story.sprint_id] &&
        sprintMap[story.sprint_id].end_date < today;

      if (isExpiredSprint) {
        const sprint = sprintMap[story.sprint_id!];
        return {
          ...story,
          unfinished_sprint_info: {
            sprint_name: sprint.name,
            days_ago: daysAgo(sprint.end_date),
          },
        };
      }

      // Realized — add sprint name
      if (story.status === "done" && story.sprint_id && sprintMap[story.sprint_id]) {
        return {
          ...story,
          realized_sprint_info: {
            sprint_name: sprintMap[story.sprint_id].name,
          },
        };
      }

      return story;
    });

    const realized = enrichedStories.filter((story) => story.status === "done");

    const assigned = enrichedStories.filter(
      (story) =>
        story.status !== "done" &&
        activeSprint &&
        story.sprint_id === activeSprint.id,
    );

    const unfinishedFromPreviousSprint = (enrichedStories as any[]).filter(
      (story) => story.unfinished_sprint_info && story.status === "ready",
    );
    
    const unfinishedBacklog = (enrichedStories as any[]).filter(
      (story) => story.unfinished_sprint_info && story.status !== "ready" && story.status !== "done",
    );
    
    const unassigned = (enrichedStories as any[]).filter(
      (story) =>
        story.status !== "done" &&
        !story.unfinished_sprint_info &&
        (!activeSprint ||
          !story.sprint_id ||
          story.sprint_id !== activeSprint.id),
    ).concat(unfinishedBacklog);

    return NextResponse.json(
      {
        activeSprint: activeSprint ?? null,
        realized,
        assigned: [...assigned, ...unfinishedFromPreviousSprint],
        unassigned,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Error loading product backlog." },
      { status: 500 },
    );
  }
}