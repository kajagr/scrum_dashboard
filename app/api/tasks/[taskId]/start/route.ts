import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * @swagger
 * /api/tasks/{taskId}/start:
 *   post:
 *     summary: Start working on a task
 *     description: >
 *       Marks a task as active and sets its status to in_progress.
 *       The task must be accepted by the current user.
 *       The user cannot have another active task at the same time.
 *       The parent story must not be completed.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the task to start
 *         example: "f6a7b8c9-d0e1-2345-fabc-678901234567"
 *     responses:
 *       200:
 *         description: Task started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Task cannot be started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     notYours:
 *                       value: "This task is not yours."
 *                     alreadyActive:
 *                       value: "Task is already active."
 *                     storyDone:
 *                       value: "The story is already completed."
 *                     hasActiveTask:
 *                       value: "You already have an active task."
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
 *       404:
 *         description: Task or story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     taskNotFound:
 *                       value: "Task not found."
 *                     storyNotFound:
 *                       value: "Story not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error starting task."
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { taskId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, user_story_id, status, assignee_id, is_accepted, is_active")
      .eq("id", taskId)
      .is("deleted_at", null)
      .maybeSingle();

    if (taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task)
      return NextResponse.json({ error: "Task not found." }, { status: 404 });

    if (!task.is_accepted || task.assignee_id !== user.id) {
      return NextResponse.json(
        { error: "This task is not yours." },
        { status: 400 },
      );
    }

    if (task.is_active) {
      return NextResponse.json(
        { error: "Task is already active." },
        { status: 400 },
      );
    }

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, status")
      .eq("id", task.user_story_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (storyError || !story)
      return NextResponse.json({ error: "Story not found." }, { status: 404 });

    if (story.status === "done") {
      return NextResponse.json(
        { error: "The story is already completed." },
        { status: 400 },
      );
    }

    const { data: activeTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("assignee_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (activeTasks && activeTasks.length > 0) {
      return NextResponse.json(
        { error: "You already have an active task." },
        { status: 400 },
      );
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from("tasks")
      .update({
        is_active: true,
        active_since: new Date().toISOString(),
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select("*, assignee:users(id, first_name, last_name, email)")
      .single();

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json(updatedTask);
  } catch {
    return NextResponse.json(
      { error: "Error starting task." },
      { status: 500 },
    );
  }
}
