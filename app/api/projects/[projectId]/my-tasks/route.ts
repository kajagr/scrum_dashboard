import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * @swagger
 * /api/projects/{projectId}/my-active-tasks:
 *   get:
 *     summary: Get current user's tasks in the active sprint
 *     description: Returns all tasks assigned to the authenticated user that belong to the active sprint in the given project and are not completed.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of tasks in the active sprint assigned to the current user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   remaining_time:
 *                     type: number
 *                   status:
 *                     type: string
 *                     enum: [unassigned, assigned, in_progress, completed]
 *                   user_story:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       title:
 *                         type: string
 *                       project_id:
 *                         type: string
 *                         format: uuid
 *                       sprint:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [planned, active, completed]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const supabase = await createClient();
  const { projectId } = await context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      remaining_time,
      status,
      user_story:user_stories!inner(
        id,
        title,
        project_id,
        sprint:sprints!inner(
          id,
          name,
          status
        )
      )
    `)
    .eq("assignee_id", user.id)
    .eq("user_story.project_id", projectId)
    .eq("user_story.sprint.status", "active") // 👈 ključni del
    .neq("status", "completed");              // 👈 filter za DONE

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
