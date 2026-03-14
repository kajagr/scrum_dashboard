import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

// POST /api/tasks/[taskId]/start
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { taskId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Pridobi nalogo
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, user_story_id, status, assignee_id, is_accepted, is_active")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    // 2. Preveri da je naloga sprejeta s strani trenutnega uporabnika
    if (!task.is_accepted || task.assignee_id !== user.id) {
      return NextResponse.json({ error: "Naloga ni vaša." }, { status: 400 });
    }

    // 3. Preveri da naloga ni že aktivna
    if (task.is_active) {
      return NextResponse.json({ error: "Naloga je že aktivna." }, { status: 400 });
    }

    // 4. Pridobi zgodbo in preveri da ni zaključena
    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, status")
      .eq("id", task.user_story_id)
      .maybeSingle();

    if (storyError || !story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

    if (story.status === "done") {
      return NextResponse.json({ error: "Zgodba je že zaključena." }, { status: 400 });
    }

    // 5. Preveri da uporabnik nima že druge aktivne naloge
    const { data: activeTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("assignee_id", user.id)
      .eq("is_active", true);

    if (activeTasks && activeTasks.length > 0) {
      return NextResponse.json({ error: "Že imate aktivno nalogo." }, { status: 400 });
    }

    // 6. Začni delo
    const { data: updatedTask, error: updateError } = await supabase
      .from("tasks")
      .update({
        is_active: true,
        active_since: new Date().toISOString(),
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select("*, assignee:users(id, first_name, last_name, email)")
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json(updatedTask);

  } catch {
    return NextResponse.json({ error: "Error starting task." }, { status: 500 });
  }
}