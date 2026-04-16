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
 * GET /api/projects/:projectId/user-stats
 *
 * Returns per-member logged hours for the project.
 * Optionally scoped to the active sprint via ?scope=sprint.
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

    const scope = request.nextUrl.searchParams.get("scope"); // "sprint" | null

    // Active sprint date range (used when scope=sprint)
    let dateFrom: string | null = null;
    let dateTo: string | null = null;

    if (scope === "sprint") {
      const today = new Date().toISOString().split("T")[0];
      const { data: activeSprint } = await supabase
        .from("sprints")
        .select("start_date, end_date")
        .eq("project_id", projectId)
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (activeSprint) {
        dateFrom = activeSprint.start_date;
        dateTo = activeSprint.end_date;
      }
    }

    // All members (vključno z odstranjenimi in product ownerji) — za statistiko prikažemo vse ki so kdaj delali
    const { data: members } = await supabase
      .from("project_members")
      .select(
        "user_id, role, removed_at, user:users(id, first_name, last_name)",
      )
      .eq("project_id", projectId)
      .in("role", ["scrum_master", "developer", "product_owner"]);

    const memberList = members ?? [];

    // Dedupliciraj po user_id — če ima kdo več zapisov (menjava vloge),
    // ohrani aktivnega (brez removed_at), sicer zadnjega
    const memberMap = new Map<string, (typeof memberList)[0]>();
    for (const m of memberList) {
      const existing = memberMap.get(m.user_id);
      if (!existing) {
        memberMap.set(m.user_id, m);
      } else {
        // Prednost ima aktivni zapis (removed_at = null)
        if (!m.removed_at) memberMap.set(m.user_id, m);
      }
    }
    const dedupedMembers = Array.from(memberMap.values());

    // All tasks in the project
    const { data: allStories } = await supabase
      .from("user_stories")
      .select("id")
      .eq("project_id", projectId)
      .is("deleted_at", null);

    const storyIds = (allStories ?? []).map((s) => s.id);

    let taskIds: string[] = [];
    if (storyIds.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .in("user_story_id", storyIds)
        .is("deleted_at", null);
      taskIds = (tasks ?? []).map((t) => t.id);
    }

    // Fetch time logs for these tasks
    let logsQuery = supabaseAdmin
      .from("time_logs")
      .select("user_id, hours, date")
      .in("task_id", taskIds.length > 0 ? taskIds : ["__none__"]);

    if (dateFrom) logsQuery = logsQuery.gte("date", dateFrom);
    if (dateTo) logsQuery = logsQuery.lte("date", dateTo);

    const { data: logs } = await logsQuery;

    // Aggregate per user
    const logsByUser: Record<string, number> = {};
    for (const log of logs ?? []) {
      logsByUser[log.user_id] =
        (logsByUser[log.user_id] ?? 0) + Number(log.hours);
    }

    const result = dedupedMembers.map((m) => {
      const u = m.user as any;
      return {
        user_id: m.user_id,
        name: u ? `${u.first_name} ${u.last_name}`.trim() : m.user_id,
        role: m.role,
        logged: Math.round((logsByUser[m.user_id] ?? 0) * 10) / 10,
        isRemoved: !!m.removed_at,
      };
    });

    // Sort by logged hours desc
    result.sort((a, b) => b.logged - a.logged);

    return NextResponse.json({ users: result, scope: scope ?? "all" });
  } catch (e) {
    console.error("GET /user-stats error:", e);
    return NextResponse.json(
      { error: "Error loading user stats." },
      { status: 500 },
    );
  }
}
