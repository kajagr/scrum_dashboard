import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

// POST /api/tasks/[taskId]/stop
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { taskId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Pridobi nalogo
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, user_story_id, status, assignee_id, is_accepted, is_active, active_since")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    // 2. Preveri da je naloga aktivna in lastnik je trenutni uporabnik
    if (!task.is_active || task.assignee_id !== user.id) {
      return NextResponse.json({ error: "Naloga ni aktivna ali ni vaša." }, { status: 400 });
    }

    // 3. Izračunaj porabljen čas
    if (!task.active_since) {
      return NextResponse.json({ error: "Napaka: active_since ni nastavljen." }, { status: 500 });
    }

    const activeSince = new Date(task.active_since);
    const now = new Date();
    const hoursSpent = (now.getTime() - activeSince.getTime()) / (1000 * 60 * 60);
    const roundedHours = Math.max(0.01, Math.round(hoursSpent * 100) / 100);

    const today = now.toISOString().split("T")[0];

    // 4. Preveri če že obstaja vpis za danes
    const { data: existingLog } = await supabase
      .from("time_logs")
      .select("id, hours")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (existingLog) {
      // Prištej ure k obstoječemu vpisu
      const { error: updateLogError } = await supabase
        .from("time_logs")
        .update({
          hours: Number(existingLog.hours) + roundedHours,
        })
        .eq("id", existingLog.id);

      if (updateLogError) return NextResponse.json({ error: updateLogError.message }, { status: 500 });
    } else {
      // Ustvari nov vpis
      const { error: insertLogError } = await supabase
        .from("time_logs")
        .insert({
          task_id: taskId,
          user_id: user.id,
          hours: roundedHours,
          date: today,
          logged_at: now.toISOString(),
        });

      if (insertLogError) return NextResponse.json({ error: insertLogError.message }, { status: 500 });
    }

    // 5. Posodobi logged_hours na tasku (seštej vse time_logs za ta task)
    const { data: allLogs } = await supabase
      .from("time_logs")
      .select("hours")
      .eq("task_id", taskId);

    const totalLoggedHours = allLogs
      ? allLogs.reduce((sum, log) => sum + Number(log.hours), 0)
      : 0;

    // 6. Ustavi nalogo
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

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json(updatedTask);

  } catch {
    return NextResponse.json({ error: "Error stopping task." }, { status: 500 });
  }
}