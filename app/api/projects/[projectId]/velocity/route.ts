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
 * GET /api/projects/:projectId/velocity
 *
 * Returns per-sprint velocity data for the project.
 * Each sprint includes:
 *   - estimated: sum of estimated_hours of tasks in sprint stories
 *   - logged:    sum of hours from time_logs for those tasks
 *   - completed: number of done stories in sprint
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

    // Preveri členstvo
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

    // Pridobi vse sprintove projekta, urejene po datumu
    const { data: sprints } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", projectId)
      .order("start_date", { ascending: true });

    if (!sprints || sprints.length === 0)
      return NextResponse.json({ sprints: [] });

    const today = new Date().toISOString().split("T")[0];

    const result = await Promise.all(
      sprints.map(async (sprint) => {
        const isCompleted = sprint.end_date < today;
        const isActive = sprint.start_date <= today && sprint.end_date >= today;

        // Zgodbe v sprintu
        const { data: stories } = await supabase
          .from("user_stories")
          .select("id, status")
          .eq("project_id", projectId)
          .eq("sprint_id", sprint.id)
          .is("deleted_at", null);

        const storyIds = (stories ?? []).map((s) => s.id);
        const completedStories = (stories ?? []).filter(
          (s) => s.status === "done",
        ).length;

        let estimated = 0;
        let logged = 0;

        if (storyIds.length > 0) {
          // Naloge → estimated_hours
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id, estimated_hours")
            .in("user_story_id", storyIds)
            .is("deleted_at", null);

          estimated = (tasks ?? []).reduce(
            (sum, t) => sum + Number(t.estimated_hours ?? 0),
            0,
          );

          const taskIds = (tasks ?? []).map((t) => t.id);

          if (taskIds.length > 0) {
            // Time logs v obdobju sprinta
            const { data: logs } = await supabaseAdmin
              .from("time_logs")
              .select("hours")
              .in("task_id", taskIds)
              .gte("date", sprint.start_date)
              .lte("date", sprint.end_date);

            logged = (logs ?? []).reduce((sum, l) => sum + Number(l.hours), 0);
          }
        }

        return {
          id: sprint.id,
          name: sprint.name,
          start_date: sprint.start_date,
          end_date: sprint.end_date,
          isCompleted,
          isActive,
          estimated: Math.round(estimated * 10) / 10,
          logged: Math.round(logged * 10) / 10,
          completedStories,
          totalStories: storyIds.length,
        };
      }),
    );

    return NextResponse.json({ sprints: result });
  } catch (e) {
    console.error("GET /velocity error:", e);
    return NextResponse.json(
      { error: "Error loading velocity data." },
      { status: 500 },
    );
  }
}
