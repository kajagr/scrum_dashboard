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
 * GET /api/projects/:projectId/story-stats
 *
 * Returns:
 *   statusBreakdown: count of stories per status
 *   sprintStories:   per-story progress for the active sprint
 *                    (estimated, logged, remaining from task.remaining_time)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!membership)
      return NextResponse.json(
        { error: "Nisi član projekta." },
        { status: 403 },
      );

    // ── Status breakdown ──────────────────────────────────────────────────────
    const { data: allStories } = await supabase
      .from("user_stories")
      .select("id, status, title, sprint_id, priority")
      .eq("project_id", projectId)
      .is("deleted_at", null);

    const stories = allStories ?? [];

    // Active sprint ID — needed to distinguish "in active sprint" vs "future releases"
    const today = new Date().toISOString().split("T")[0];
    const { data: activeSprintData } = await supabase
      .from("sprints")
      .select("id")
      .eq("project_id", projectId)
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();
    const activeSprintId = activeSprintData?.id ?? null;

    // Completed sprint IDs (end_date < today) — bolj robustno kot primerjava start_date
    const { data: completedSprints } = await supabase
      .from("sprints")
      .select("id")
      .eq("project_id", projectId)
      .lt("end_date", today);
    const completedSprintIds = new Set(
      (completedSprints ?? []).map((s) => s.id),
    );

    // Zgodbe iz zaključenih sprintov (unfinished) — enaka logika kot backlog route
    const isExpiredSprint = (s: any) =>
      s.sprint_id && s.status !== "done" && completedSprintIds.has(s.sprint_id);

    const statusBreakdown = {
      // Nima sprinta, ali je iz zaključenega sprinta (ni ready) — ni done, ni wont_have
      unassigned: stories.filter(
        (s) =>
          s.status !== "done" &&
          s.priority !== "wont_have" &&
          !["ready"].includes(s.status) &&
          (!s.sprint_id || isExpiredSprint(s)) &&
          s.sprint_id !== activeSprintId,
      ).length,
      // V aktivnem sprintu, še ni ready/done, ni wont_have
      in_active_sprint: stories.filter(
        (s) =>
          s.sprint_id === activeSprintId &&
          !["ready", "done"].includes(s.status) &&
          s.priority !== "wont_have",
      ).length,
      // Status ready (vključno z iz zaključenih sprintov)
      ready_for_review: stories.filter((s) => s.status === "ready").length,
      // Zaključene
      done: stories.filter((s) => s.status === "done").length,
      // priority = wont_have
      future_releases: stories.filter((s) => s.priority === "wont_have").length,
    };

    // ── Active sprint stories progress ────────────────────────────────────────
    const { data: activeSprint } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", projectId)
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();

    let sprintStories: {
      id: string;
      title: string;
      status: string;
      estimated: number;
      logged: number;
      remaining: number | null;
    }[] = [];

    if (activeSprint) {
      const sprintStoriesRaw = stories.filter(
        (s) => s.sprint_id === activeSprint.id,
      );

      sprintStories = await Promise.all(
        sprintStoriesRaw.map(async (story) => {
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id, estimated_hours, remaining_time")
            .eq("user_story_id", story.id)
            .is("deleted_at", null);

          const taskList = tasks ?? [];
          const estimated = taskList.reduce(
            (sum, t) => sum + Number(t.estimated_hours ?? 0),
            0,
          );
          const remaining = taskList.reduce(
            (sum, t) => sum + Number(t.remaining_time ?? 0),
            0,
          );
          const taskIds = taskList.map((t) => t.id);

          let logged = 0;
          if (taskIds.length > 0) {
            const { data: logs } = await supabaseAdmin
              .from("time_logs")
              .select("hours")
              .in("task_id", taskIds);
            logged = (logs ?? []).reduce((sum, l) => sum + Number(l.hours), 0);
          }

          return {
            id: story.id,
            title: story.title,
            status: story.status,
            estimated: Math.round(estimated * 10) / 10,
            logged: Math.round(logged * 10) / 10,
            remaining: Math.round(remaining * 10) / 10,
          };
        }),
      );
    }

    return NextResponse.json({
      statusBreakdown,
      activeSprint: activeSprint ?? null,
      sprintStories,
    });
  } catch (e) {
    console.error("GET /story-stats error:", e);
    return NextResponse.json(
      { error: "Error loading story stats." },
      { status: 500 },
    );
  }
}
