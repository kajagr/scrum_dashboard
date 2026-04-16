import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * @swagger
 * /api/tasks/{taskId}/timelogs:
 *   get:
 *     summary: Get all time logs for a task
 *     description: Returns all time log entries for the given task, ordered by date descending. Only the task's assignee can view their logs.
 *     tags:
 *       - TimeLogs
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of time logs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the task assignee
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, context: RouteContext) {
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
      .select("id, assignee_id, is_accepted")
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

    if (task.assignee_id !== user.id)
      return NextResponse.json(
        { error: "Nimate dostopa do tega vnosa." },
        { status: 403 },
      );

    const { data: logs, error: logsError } = await supabase
      .from("time_logs")
      .select("id, task_id, user_id, hours, date, logged_at")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (logsError)
      return NextResponse.json({ error: logsError.message }, { status: 500 });

    return NextResponse.json(logs ?? []);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju vnosov." },
      { status: 500 },
    );
  }
}

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
 *                 example: "2026-04-07"
 *               hours_spent:
 *                 type: number
 *                 example: 2.5
 *     responses:
 *       200:
 *         description: Time logged successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Task not accepted by current user
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
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
    const remainingTime = body.remaining_time !== undefined ? Number(body.remaining_time) : undefined;

    if (!hoursSpent || isNaN(hoursSpent) || hoursSpent <= 0)
      return NextResponse.json(
        { error: "Število ur mora biti večje od 0." },
        { status: 400 },
      );

    if (!date)
      return NextResponse.json({ error: "Datum je obvezen." }, { status: 400 });

    if (remainingTime === undefined || isNaN(remainingTime) || remainingTime < 0)
      return NextResponse.json(
        { error: "Preostali čas je obvezen in mora biti 0 ali več." },
        { status: 400 },
      );

    const today = new Date().toISOString().split("T")[0];
    if (date > today)
      return NextResponse.json(
        { error: "Datum ne sme biti v prihodnosti." },
        { status: 400 },
      );

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

    if (!task.is_accepted || task.assignee_id !== user.id)
      return NextResponse.json(
        { error: "Vnos časa ni dovoljen: naloga ni bila sprejeta." },
        { status: 403 },
      );

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, status, sprint_id")
      .eq("id", task.user_story_id)
      .maybeSingle();

    if (storyError || !story)
      return NextResponse.json(
        { error: "Zgodba ni bila najdena." },
        { status: 404 },
      );

    if (story.status === "done")
      return NextResponse.json(
        { error: "Vnos časa ni dovoljen: zgodba je že zaključena." },
        { status: 400 },
      );

    if (story.sprint_id) {
      const { data: sprint } = await supabase
        .from("sprints")
        .select("start_date, end_date")
        .eq("id", story.sprint_id)
        .maybeSingle();

      if (sprint && (date < sprint.start_date || date > sprint.end_date))
        return NextResponse.json(
          {
            error: `Datum mora biti znotraj sprinta (${sprint.start_date} – ${sprint.end_date}).`,
          },
          { status: 400 },
        );
    }

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
        .update({ hours: Number(existingLog.hours) + hoursSpent, remaining_time: remainingTime })
        .eq("id", existingLog.id)
        .select("id, task_id, user_id, hours, date, logged_at, remaining_time")
        .single();

      if (updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
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
          remaining_time: remainingTime,
        })
        .select("id, task_id, user_id, hours, date, logged_at, remaining_time")
        .single();

      if (insertError)
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        );
      resultLog = inserted;
    }

    const { data: allLogs } = await supabaseAdmin
      .from("time_logs")
      .select("hours")
      .eq("task_id", taskId);

    const totalLoggedHours = allLogs
      ? allLogs.reduce((sum, l) => sum + Number(l.hours), 0)
      : 0;

    const taskUpdate: Record<string, unknown> = {
      logged_hours: totalLoggedHours,
      remaining_time: remainingTime,
      updated_at: new Date().toISOString(),
    };
    if (remainingTime === 0) {
      taskUpdate.status = "completed";
    }

    await supabase
      .from("tasks")
      .update(taskUpdate)
      .eq("id", taskId);

    return NextResponse.json(resultLog);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri vnosu časa." },
      { status: 500 },
    );
  }
}
