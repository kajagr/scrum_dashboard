import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * @swagger
 * /api/users/me/timelogs:
 *   get:
 *     summary: Get current user's time logs
 *     description: >
 *       Returns all time logs for the currently authenticated user,
 *       optionally filtered by date range. Each log includes task title,
 *       description, and parent story info.
 *     tags:
 *       - TimeLogs
 *     parameters:
 *       - in: query
 *         name: from_date
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (inclusive), format YYYY-MM-DD
 *         example: "2026-04-01"
 *       - in: query
 *         name: to_date
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (inclusive), format YYYY-MM-DD
 *         example: "2026-04-07"
 *     responses:
 *       200:
 *         description: List of time logs for the current user
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
 *                   task_id:
 *                     type: string
 *                     format: uuid
 *                   hours:
 *                     type: number
 *                     example: 2.5
 *                   date:
 *                     type: string
 *                     format: date
 *                     example: "2026-04-07"
 *                   logged_at:
 *                     type: string
 *                     format: date-time
 *                   task:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       remaining_time:
 *                         type: number
 *                         nullable: true
 *                       user_story:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           status:
 *                             type: string
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
 *                   example: "Error fetching time logs."
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");

    const projectId = searchParams.get("project_id");

    let query = supabase
      .from("time_logs")
      .select(
        "id, task_id, hours, date, logged_at, remaining_time, task:tasks!inner(id, title, description, remaining_time, status, user_story:user_stories!inner(id, title, status, project_id, sprint:sprints(id, start_date, end_date)))",
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("logged_at", { ascending: false });

    if (fromDate) query = query.gte("date", fromDate);
    if (toDate) query = query.lte("date", toDate);
    if (projectId) query = query.eq("task.user_story.project_id", projectId);

    const { data, error } = await query;

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json(
      { error: "Error fetching time logs." },
      { status: 500 },
    );
  }
}
