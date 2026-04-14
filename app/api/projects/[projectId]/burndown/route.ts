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

/**
 * @swagger
 * /api/projects/{projectId}/burndown:
 *   get:
 *     summary: Get burndown chart data for a sprint
 *     description: >
 *       Returns burndown data for a sprint of a project.
 *       If sprintId is provided, returns data for that sprint.
 *       Otherwise returns the active sprint, or falls back to the most recently ended one.
 *       Includes ideal line, actual remaining work, and logged work per day.
 *       Uses estimated_hours from tasks and hours from time_logs.
 *     tags:
 *       - Burndown
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: sprintId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the sprint to show. Defaults to the active or most recent sprint.
 *     responses:
 *       200:
 *         description: Burndown data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sprint:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     start_date:
 *                       type: string
 *                     end_date:
 *                       type: string
 *                 totalEstimated:
 *                   type: number
 *                 days:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       ideal:
 *                         type: number
 *                       remaining:
 *                         type: number
 *                       logged:
 *                         type: number
 *                       isToday:
 *                         type: boolean
 *                       isFuture:
 *                         type: boolean
 *       404:
 *         description: No active sprint found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];
    const sprintId = request.nextUrl.searchParams.get("sprintId");

    // Find the requested sprint, active sprint, or most recently ended sprint
    let sprint: { id: string; name: string; start_date: string; end_date: string } | null = null;

    if (sprintId) {
      const { data: requestedSprint } = await supabase
        .from("sprints")
        .select("id, name, start_date, end_date")
        .eq("project_id", projectId)
        .eq("id", sprintId)
        .maybeSingle();
      sprint = requestedSprint;
    } else {
      const { data: activeSprint } = await supabase
        .from("sprints")
        .select("id, name, start_date, end_date")
        .eq("project_id", projectId)
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (activeSprint) {
        sprint = activeSprint;
      } else {
        // Fall back to most recently ended sprint
        const { data: lastSprint } = await supabase
          .from("sprints")
          .select("id, name, start_date, end_date")
          .eq("project_id", projectId)
          .lt("end_date", today)
          .order("end_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        sprint = lastSprint;
      }
    }

    if (!sprint)
      return NextResponse.json({ error: "No sprint found." }, { status: 404 });

    // Get all tasks in sprint stories
    const { data: stories } = await supabase
      .from("user_stories")
      .select("id")
      .eq("project_id", projectId)
      .eq("sprint_id", sprint.id)
      .is("deleted_at", null);

    const storyIds = (stories ?? []).map((s) => s.id);

    let tasks: { id: string; estimated_hours: number | null }[] = [];
    if (storyIds.length > 0) {
      const { data: taskData } = await supabase
        .from("tasks")
        .select("id, estimated_hours")
        .in("user_story_id", storyIds)
        .is("deleted_at", null);
      tasks = taskData ?? [];
    }

    const totalEstimated = tasks.reduce((s, t) => s + Number(t.estimated_hours ?? 0), 0);
    const taskIds = tasks.map((t) => t.id);

    // Get all time logs for these tasks within sprint range
    let logsByDate: Record<string, number> = {};
    if (taskIds.length > 0) {
      const { data: logs } = await supabaseAdmin
        .from("time_logs")
        .select("date, hours")
        .in("task_id", taskIds)
        .gte("date", sprint.start_date)
        .lte("date", sprint.end_date);

      for (const log of logs ?? []) {
        const d = log.date;
        logsByDate[d] = (logsByDate[d] ?? 0) + Number(log.hours);
      }
    }

    // Build day-by-day data
    const start = new Date(sprint.start_date + "T12:00:00");
    const end = new Date(sprint.end_date + "T12:00:00");
    const todayDate = new Date(today + "T12:00:00");

    const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const days: {
      date: string;
      ideal: number;
      remaining: number | null;
      logged: number;
      isToday: boolean;
      isFuture: boolean;
    }[] = [];

    let cumulativeLogged = 0;

    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const isFuture = d > todayDate;
      const isToday = dateStr === today;

      // Ideal: linear from totalEstimated to 0
      const ideal = totalEstimated * (1 - i / totalDays);

      const loggedToday = logsByDate[dateStr] ?? 0;
      cumulativeLogged += loggedToday;

      const remaining = isFuture ? null : Math.max(0, totalEstimated - cumulativeLogged);

      days.push({
        date: dateStr,
        ideal: Math.round(ideal * 100) / 100,
        remaining,
        logged: Math.round(cumulativeLogged * 100) / 100,
        isToday,
        isFuture,
      });
    }

    return NextResponse.json({
      sprint,
      totalEstimated,
      days,
    });
  } catch (e) {
    console.error("GET /burndown error:", e);
    return NextResponse.json({ error: "Error loading burndown data." }, { status: 500 });
  }
}