import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * @swagger
 * /api/tasks/{taskId}/timelogs:
 *   post:
 *     summary: Log time for a task
 *     description: >
 *       Creates a time log entry for the given task on the specified date.
 *       If a log already exists for that day, the hours are added to it.
 *       The task must be accepted by the current user.
 *       The parent story must not be completed.
 *       The date must not be in the future.
 *     tags:
 *       - TimeLogs
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the task
 *         example: "f6a7b8c9-d0e1-2345-fabc-678901234567"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, hours_spent]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: The date to log time for (YYYY-MM-DD). Must not be in the future.
 *                 example: "2026-04-07"
 *               hours_spent:
 *                 type: number
 *                 description: Hours spent. Must be greater than 0.
 *                 example: 2.5
 *     responses:
 *       200:
 *         description: Time logged successfully
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
 *                     futureDate:
 *                       value: "Datum ne sme biti v prihodnosti."
 *                     storyDone:
 *                       value: "Vnos časa ni dovoljen: zgodba je že zaključena."
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
 *         description: Task not accepted by current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vnos časa ni dovoljen: naloga ni bila sprejeta."
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Naloga ni bila najdena."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri vnosu časa."
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

    const body = await request.json();
    const hoursSpent = Number(body.hours_spent);
    const date: string = body.date;

    if (!hoursSpent || isNaN(hoursSpent) || hoursSpent <= 0) {
      return NextResponse.json(
        { error: "Število ur mora biti večje od 0." },
        { status: 400 },
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: "Datum je obvezen." },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().split("T")[0];
    if (date > today) {
      return NextResponse.json(
        { error: "Datum ne sme biti v prihodnosti." },
        { status: 400 },
      );
    }

    // Fetch the task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, user_story_id, assignee_id, is_accepted, remaining_time")
      .eq("id", taskId)
      .is("deleted_at", null)
      .maybeSingle();

    if (taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task)
      return NextResponse.json(
        { error: "Naloga ni bila najdena." },
        { status: 404 },
      );

    if (!task.is_accepted || task.assignee_id !== user.id) {
      return NextResponse.json(
        { error: "Vnos časa ni dovoljen: naloga ni bila sprejeta." },
        { status: 403 },
      );
    }

    // Verify story is not completed
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
        { error: "Vnos časa ni dovoljen: zgodba je že zaključena." },
        { status: 400 },
      );
    }

    // Check if a log already exists for this day
    const { data: existingLog } = await supabase
      .from("time_logs")
      .select("id, hours")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();

    let resultLog;

    if (existingLog) {
      const { data: updated, error: updateError } = await supabase
        .from("time_logs")
        .update({ hours: Number(existingLog.hours) + hoursSpent })
        .eq("id", existingLog.id)
        .select("id, task_id, user_id, hours, date, logged_at")
        .single();

      if (updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      resultLog = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("time_logs")
        .insert({
          task_id: taskId,
          user_id: user.id,
          hours: hoursSpent,
          date,
          logged_at: new Date().toISOString(),
        })
        .select("id, task_id, user_id, hours, date, logged_at")
        .single();

      if (insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      resultLog = inserted;
    }

    // Recalculate total logged_hours on the task
    const { data: allLogs } = await supabase
      .from("time_logs")
      .select("hours")
      .eq("task_id", taskId);

    const totalLoggedHours = allLogs
      ? allLogs.reduce((sum, l) => sum + Number(l.hours), 0)
      : 0;

    // Subtract newly logged hours from remaining_time, floor at 0
    const newRemaining =
      task.remaining_time != null
        ? Math.max(0, Number(task.remaining_time) - hoursSpent)
        : null;

    await supabase
      .from("tasks")
      .update({
        logged_hours: totalLoggedHours,
        remaining_time: newRemaining,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    return NextResponse.json(resultLog);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri vnosu časa." },
      { status: 500 },
    );
  }
}
