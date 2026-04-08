import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * @swagger
 * /api/timelogs/{id}:
 *   put:
 *     summary: Edit a time log entry
 *     description: >
 *       Updates the hours_spent for an existing time log entry.
 *       Only the owner of the log can edit it.
 *       Editing is blocked if the task belongs to a completed story (status = done)
 *       or if the task has not been accepted by the current user.
 *     tags:
 *       - TimeLogs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the time log entry
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hours_spent]
 *             properties:
 *               hours_spent:
 *                 type: number
 *                 description: New hours value. Must be greater than 0.
 *                 example: 3.5
 *     responses:
 *       200:
 *         description: Time log updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 task_id:
 *                   type: string
 *                 hours:
 *                   type: number
 *                 date:
 *                   type: string
 *                   format: date
 *                 logged_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     invalidHours:
 *                       value: "Število ur mora biti večje od 0."
 *                     storyDone:
 *                       value: "Urejanje ni dovoljeno: zgodba je že zaključena."
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
 *         description: Log does not belong to current user or task not accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     notOwner:
 *                       value: "Nimate dostopa do tega vnosa."
 *                     taskNotAccepted:
 *                       value: "Urejanje ni dovoljeno: naloga ni bila sprejeta."
 *       404:
 *         description: Time log not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vnos časa ni bil najden."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri posodabljanju vnosa."
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const hoursSpent = Number(body.hours_spent);

    if (!body.hours_spent || isNaN(hoursSpent) || hoursSpent <= 0) {
      return NextResponse.json(
        { error: "Število ur mora biti večje od 0." },
        { status: 400 },
      );
    }

    // Fetch the log and verify ownership
    const { data: log, error: logError } = await supabase
      .from("time_logs")
      .select("id, task_id, user_id, hours")
      .eq("id", id)
      .maybeSingle();

    if (logError)
      return NextResponse.json({ error: logError.message }, { status: 500 });
    if (!log)
      return NextResponse.json(
        { error: "Vnos časa ni bil najden." },
        { status: 404 },
      );

    if (log.user_id !== user.id) {
      return NextResponse.json(
        { error: "Nimate dostopa do tega vnosa." },
        { status: 403 },
      );
    }

    // Verify the task is accepted by current user
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, user_story_id, assignee_id, is_accepted, remaining_time")
      .eq("id", log.task_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (taskError || !task)
      return NextResponse.json(
        { error: "Naloga ni bila najdena." },
        { status: 404 },
      );

    if (!task.is_accepted || task.assignee_id !== user.id) {
      return NextResponse.json(
        { error: "Urejanje ni dovoljeno: naloga ni bila sprejeta." },
        { status: 403 },
      );
    }

    // Verify the story is not completed
    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, status")
      .eq("id", task.user_story_id)
      .maybeSingle();

    if (storyError || !story)
      return NextResponse.json(
        { error: "Zgodba ni bila najdena." },
        { status: 404 },
      );

    if (story.status === "done") {
      return NextResponse.json(
        { error: "Urejanje ni dovoljeno: zgodba je že zaključena." },
        { status: 400 },
      );
    }

    // Update the log
    const { data: updated, error: updateError } = await supabase
      .from("time_logs")
      .update({ hours: hoursSpent })
      .eq("id", id)
      .select("id, task_id, user_id, hours, date, logged_at")
      .single();

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Recalculate total logged_hours on the task
    const { data: allLogs } = await supabase
      .from("time_logs")
      .select("hours")
      .eq("task_id", log.task_id);

    const totalLoggedHours = allLogs
      ? allLogs.reduce((sum, l) => sum + Number(l.hours), 0)
      : 0;

    // Adjust remaining_time by delta (new hours - old hours), floor at 0
    const oldHours = Number(log.hours);
    const delta = hoursSpent - oldHours;
    const newRemaining =
      task.remaining_time != null
        ? Math.max(0, Number(task.remaining_time) - delta)
        : null;

    await supabase
      .from("tasks")
      .update({
        logged_hours: totalLoggedHours,
        remaining_time: newRemaining,
        updated_at: new Date().toISOString(),
      })
      .eq("id", log.task_id);

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri posodabljanju vnosa." },
      { status: 500 },
    );
  }
}
