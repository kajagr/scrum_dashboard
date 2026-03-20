import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * @swagger
 * /api/tasks/{taskId}/stop:
 *   post:
 *     summary: Stop working on a task
 *     description: >
 *       Stops an active task, logs the time spent since it was started,
 *       and sets the task status back to assigned.
 *       Time is logged per day — if a log already exists for today, the hours are added to it.
 *       The total logged hours on the task are also updated.
 *       Only the current assignee can stop their own active task.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the task to stop
 *         example: "f6a7b8c9-d0e1-2345-fabc-678901234567"
 *     responses:
 *       200:
 *         description: Task stopped and time logged successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Task'
 *                 - type: object
 *                   properties:
 *                     is_active:
 *                       type: boolean
 *                       example: false
 *                     active_since:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     logged_hours:
 *                       type: number
 *                       description: Total hours logged across all sessions
 *                       example: 3.5
 *                     status:
 *                       type: string
 *                       example: "assigned"
 *       400:
 *         description: Task is not active or does not belong to the current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Task is not active or does not belong to you."
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
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Task not found."
 *       500:
 *         description: Internal server error or missing active_since timestamp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missingActiveSince:
 *                       value: "Error: active_since is not set."
 *                     generic:
 *                       value: "Error stopping task."
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
      .select(
        "id, user_story_id, status, assignee_id, is_accepted, is_active, active_since",
      )
      .eq("id", taskId)
      .is("deleted_at", null)
      .maybeSingle();

    if (taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task)
      return NextResponse.json({ error: "Task not found." }, { status: 404 });

    if (!task.is_active || task.assignee_id !== user.id) {
      return NextResponse.json(
        { error: "Task is not active or does not belong to you." },
        { status: 400 },
      );
    }

    if (!task.active_since) {
      return NextResponse.json(
        { error: "Error: active_since is not set." },
        { status: 500 },
      );
    }

    const activeSince = new Date(task.active_since);
    const now = new Date();
    const hoursSpent =
      (now.getTime() - activeSince.getTime()) / (1000 * 60 * 60);
    const roundedHours = Math.max(0.01, Math.round(hoursSpent * 100) / 100);

    const today = now.toISOString().split("T")[0];

    const { data: existingLog } = await supabase
      .from("time_logs")
      .select("id, hours")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (existingLog) {
      const { error: updateLogError } = await supabase
        .from("time_logs")
        .update({
          hours: Number(existingLog.hours) + roundedHours,
        })
        .eq("id", existingLog.id);

      if (updateLogError)
        return NextResponse.json(
          { error: updateLogError.message },
          { status: 500 },
        );
    } else {
      const { error: insertLogError } = await supabase
        .from("time_logs")
        .insert({
          task_id: taskId,
          user_id: user.id,
          hours: roundedHours,
          date: today,
          logged_at: now.toISOString(),
        });

      if (insertLogError)
        return NextResponse.json(
          { error: insertLogError.message },
          { status: 500 },
        );
    }

    const { data: allLogs } = await supabase
      .from("time_logs")
      .select("hours")
      .eq("task_id", taskId);

    const totalLoggedHours = allLogs
      ? allLogs.reduce((sum, log) => sum + Number(log.hours), 0)
      : 0;

    const { data: updatedTask, error: updateError } = await supabase
      .from("tasks")
      .update({
        is_active: false,
        active_since: null,
        status: "assigned",
        logged_hours: totalLoggedHours,
        updated_at: now.toISOString(),
      })
      .eq("id", taskId)
      .select("*, assignee:users(id, first_name, last_name, email)")
      .single();

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json(updatedTask);
  } catch {
    return NextResponse.json(
      { error: "Error stopping task." },
      { status: 500 },
    );
  }
}
