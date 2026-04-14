import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * @swagger
 * /api/projects/{projectId}/my-tasks:
 *   get:
 *     summary: Get tasks assigned to the current user in a project
 *     description: Returns all tasks assigned to the authenticated user that belong to user stories in the given project.
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
 *         description: List of tasks assigned to the current user
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
 *                   user_story:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       title:
 *                         type: string
 *                       status:
 *                         type: string
 *                       project_id:
 *                         type: string
 *                         format: uuid
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

  // Fetch all tasks assigned to the current user in this project,
  // via user_stories that belong to the project
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, remaining_time, user_story:user_stories!inner(id, title, status, project_id)",
    )
    .eq("assignee_id", user.id)
    .eq("user_story.project_id", projectId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
