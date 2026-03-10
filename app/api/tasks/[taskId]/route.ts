import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

// PATCH /api/tasks/[taskId] - Update task status
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { taskId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Pridobi nalogo
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, user_story_id, status, assignee_id")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    // 2. Pridobi zgodbo za preverjanje projekta
    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, status")
      .eq("id", task.user_story_id)
      .maybeSingle();

    if (storyError || !story) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }

    // 3. Preveri da je uporabnik član projekta
    const { data: membership, error: memberError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    }

    // 4. Preberi body
    const body = await request.json();
    const { status: newStatus } = body;

    // 5. Validacija statusa
    const validStatuses = ["todo", "in_progress", "done"];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: todo, in_progress, or done." },
        { status: 400 }
      );
    }

    // 6. Če se naloga začne (in_progress), mora imeti assignee
    //    Če nima, jo dodeli trenutnemu uporabniku
    let assigneeId = task.assignee_id;
    if (newStatus === "in_progress" && !assigneeId) {
      // Preveri da je uporabnik developer ali scrum_master
      if (membership.role !== "developer" && membership.role !== "scrum_master") {
        return NextResponse.json(
          { error: "Only developers and scrum masters can work on tasks." },
          { status: 403 }
        );
      }
      assigneeId = user.id;
    }

    // 7. Posodobi nalogo
    const { data: updatedTask, error: updateError } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        assignee_id: assigneeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select(`
        *,
        assignee:users(id, first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedTask);
  } catch {
    return NextResponse.json(
      { error: "Error updating task." },
      { status: 500 }
    );
  }
}

// GET /api/tasks/[taskId] - Get single task
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { taskId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:users(id, first_name, last_name, email)
      `)
      .eq("id", taskId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Error fetching task." },
      { status: 500 }
    );
  }
}