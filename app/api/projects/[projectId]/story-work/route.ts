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
 * GET /api/projects/:projectId/story-work
 *
 * Za aktivni sprint vrne:
 *   stories[]:
 *     id, title, status
 *     contributors[]: { user_id, name, hours, isRemoved }
 *     tasks[]:
 *       id, title
 *       contributors[]: { user_id, name, hours, isRemoved }
 *   allUsers[]: { user_id, name, isRemoved } — za konsistentno dodelitev barv
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

    // Aktivni sprint
    const today = new Date().toISOString().split("T")[0];
    const { data: activeSprint } = await supabase
      .from("sprints")
      .select("id, name")
      .eq("project_id", projectId)
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();

    if (!activeSprint)
      return NextResponse.json({ stories: [], allUsers: [], sprintName: null });

    // Vsi člani projekta (vključno z odstranjenimi in product ownerji)
    const { data: members } = await supabase
      .from("project_members")
      .select("user_id, removed_at, user:users(id, first_name, last_name)")
      .eq("project_id", projectId);

    // Dedupliciraj po user_id — prednost ima aktivni zapis
    const userMap = new Map<string, { name: string; isRemoved: boolean }>();
    for (const m of members ?? []) {
      const u = m.user as any;
      const name = u ? `${u.first_name} ${u.last_name}`.trim() : m.user_id;
      const existing = userMap.get(m.user_id);
      if (!existing || (!m.removed_at && existing.isRemoved)) {
        userMap.set(m.user_id, { name, isRemoved: !!m.removed_at });
      }
    }

    // Zgodbe v aktivnem sprintu
    const { data: stories } = await supabase
      .from("user_stories")
      .select("id, title, status")
      .eq("project_id", projectId)
      .eq("sprint_id", activeSprint.id)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    const storyList = stories ?? [];

    // Za vsako zgodbo pridobi taske in time_logs
    const enrichedStories = await Promise.all(
      storyList.map(async (story) => {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("user_story_id", story.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });

        const taskList = tasks ?? [];
        const taskIds = taskList.map((t) => t.id);

        // Vse time_logs za te taske
        const { data: logs } =
          taskIds.length > 0
            ? await supabaseAdmin
                .from("time_logs")
                .select("task_id, user_id, hours")
                .in("task_id", taskIds)
            : { data: [] };

        const logList = logs ?? [];

        // Agregiraj po tasku
        const enrichedTasks = taskList.map((task) => {
          const taskLogs = logList.filter((l) => l.task_id === task.id);
          const byUser: Record<string, number> = {};
          for (const log of taskLogs) {
            byUser[log.user_id] =
              (byUser[log.user_id] ?? 0) + Number(log.hours);
          }
          const contributors = Object.entries(byUser)
            .map(([uid, hours]) => ({
              user_id: uid,
              name: userMap.get(uid)?.name ?? uid,
              hours: Math.round(hours * 10) / 10,
              isRemoved: userMap.get(uid)?.isRemoved ?? false,
            }))
            .filter((c) => c.hours > 0)
            .sort((a, b) => b.hours - a.hours);

          return { id: task.id, title: task.title, contributors };
        });

        // Agregiraj po zgodbi (vsota vseh taskov)
        const storyByUser: Record<string, number> = {};
        for (const log of logList) {
          storyByUser[log.user_id] =
            (storyByUser[log.user_id] ?? 0) + Number(log.hours);
        }
        const storyContributors = Object.entries(storyByUser)
          .map(([uid, hours]) => ({
            user_id: uid,
            name: userMap.get(uid)?.name ?? uid,
            hours: Math.round(hours * 10) / 10,
            isRemoved: userMap.get(uid)?.isRemoved ?? false,
          }))
          .filter((c) => c.hours > 0)
          .sort((a, b) => b.hours - a.hours);

        return {
          id: story.id,
          title: story.title,
          status: story.status,
          contributors: storyContributors,
          tasks: enrichedTasks,
        };
      }),
    );

    // Seznam vseh userjev ki so karkoli prispevali (za konsistentne barve)
    const allContributorIds = new Set(
      enrichedStories.flatMap((s) => s.contributors.map((c) => c.user_id)),
    );
    const allUsers = Array.from(allContributorIds).map((uid) => ({
      user_id: uid,
      name: userMap.get(uid)?.name ?? uid,
      isRemoved: userMap.get(uid)?.isRemoved ?? false,
    }));

    return NextResponse.json({
      sprintName: activeSprint.name,
      stories: enrichedStories,
      allUsers,
    });
  } catch (e) {
    console.error("GET /story-work error:", e);
    return NextResponse.json(
      { error: "Error loading story work data." },
      { status: 500 },
    );
  }
}
