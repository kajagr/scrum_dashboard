import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
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
      .select("id, user_story_id, status, assignee_id, is_accepted")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task)
      return NextResponse.json({ error: "Task not found." }, { status: 404 });

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, sprint_id, status")
      .eq("id", task.user_story_id)
      .maybeSingle();

    if (storyError || !story)
      return NextResponse.json({ error: "Story not found." }, { status: 404 });

    const { data: membership, error: memberError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError)
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    if (!membership)
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 },
      );

    const body = await request.json();
    const { action, status: newStatus } = body;

    // -------------------------------------------------------
    // #16 - SPREJEMANJE NALOGE
    // -------------------------------------------------------
    if (action === "accept") {
      if (
        membership.role !== "developer" &&
        membership.role !== "scrum_master"
      ) {
        return NextResponse.json(
          {
            error:
              "Samo razvijalci in skrbniki metodologije lahko sprejmejo nalogo.",
          },
          { status: 403 },
        );
      }

      if (!story.sprint_id) {
        return NextResponse.json(
          { error: "Naloga ni v nobenem sprintu." },
          { status: 400 },
        );
      }

      const { data: sprint } = await supabase
        .from("sprints")
        .select("start_date, end_date")
        .eq("id", story.sprint_id)
        .maybeSingle();

      if (!sprint)
        return NextResponse.json(
          { error: "Sprint ne obstaja." },
          { status: 400 },
        );

      const today = new Date().toISOString().split("T")[0];
      const sprintStatus =
        today < sprint.start_date
          ? "planned"
          : today > sprint.end_date
            ? "completed"
            : "active";

      if (sprintStatus !== "active") {
        return NextResponse.json(
          { error: "Nalogo lahko sprejmete samo v aktivnem sprintu." },
          { status: 400 },
        );
      }

      // Že sprejeta
      if (task.is_accepted) {
        return NextResponse.json(
          { error: "Naloga je že sprejeta." },
          { status: 400 },
        );
      }

      // Predlagana drugemu članu
      if (task.assignee_id && task.assignee_id !== user.id) {
        return NextResponse.json(
          { error: "Naloga je dodeljena drugemu članu." },
          { status: 400 },
        );
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from("tasks")
        .update({
          assignee_id: user.id,
          is_accepted: true,
          status: "assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select("*, assignee:users(id, first_name, last_name, email)")
        .single();

      if (updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      return NextResponse.json(updatedTask);
    }

    // -------------------------------------------------------
    // #17 - ODPOVEDOVANJE NALOGI
    // -------------------------------------------------------
    if (action === "resign") {
      if (!task.is_accepted || task.assignee_id !== user.id) {
        return NextResponse.json(
          { error: "Niste lastnik te naloge." },
          { status: 400 },
        );
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from("tasks")
        .update({
          assignee_id: null,
          is_accepted: false,
          status: "unassigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select("*, assignee:users(id, first_name, last_name, email)")
        .single();

      if (updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      return NextResponse.json(updatedTask);
    }

    // -------------------------------------------------------
    // #15 - UREJANJE NALOGE (description, estimated_hours, assignee_id)
    // -------------------------------------------------------
    if (action === "edit") {
      if (
        membership.role !== "developer" &&
        membership.role !== "scrum_master"
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za urejanje naloge." },
          { status: 403 },
        );
      }
      if (task.is_accepted) {
        return NextResponse.json(
          { error: "Sprejete naloge ni mogoče urejati." },
          { status: 400 },
        );
      }

      const estimatedHours =
        body.estimated_hours === undefined || body.estimated_hours === ""
          ? null
          : Number(body.estimated_hours);
      if (
        estimatedHours !== null &&
        (isNaN(estimatedHours) || estimatedHours <= 0)
      ) {
        return NextResponse.json(
          { error: "Ocena časa mora biti pozitivno število." },
          { status: 400 },
        );
      }

      const assigneeId =
        body.assignee_id === "" ? null : (body.assignee_id ?? null);

      const { data: updatedTask, error: updateError } = await supabase
        .from("tasks")
        .update({
          description: body.description?.trim() || null,
          estimated_hours: estimatedHours,
          assignee_id: assigneeId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select("*, assignee:users(id, first_name, last_name, email)")
        .single();
      if (updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      return NextResponse.json(updatedTask);
    }

    // -------------------------------------------------------
    // POSODOBITEV STATUSA (obstoječa logika, posodobljena)
    // -------------------------------------------------------
    const validStatuses = [
      "unassigned",
      "assigned",
      "in_progress",
      "completed",
    ];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be: unassigned, assigned, in_progress, or completed.",
        },
        { status: 400 },
      );
    }

    let assigneeId = task.assignee_id;
    if (newStatus === "in_progress" && !assigneeId) {
      if (
        membership.role !== "developer" &&
        membership.role !== "scrum_master"
      ) {
        return NextResponse.json(
          { error: "Only developers and scrum masters can work on tasks." },
          { status: 403 },
        );
      }
      assigneeId = user.id;
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        assignee_id: assigneeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select("*, assignee:users(id, first_name, last_name, email)")
      .single();

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json(updatedTask);
  } catch {
    return NextResponse.json(
      { error: "Error updating task." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { taskId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("tasks")
      .select("*, assignee:users(id, first_name, last_name, email)")
      .eq("id", taskId)
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Error fetching task." },
      { status: 500 },
    );
  }
}

// -------------------------------------------------------
// #15 - BRISANJE NALOGE
// -------------------------------------------------------
export async function DELETE(request: NextRequest, context: RouteContext) {
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
      .select("id, user_story_id, is_accepted")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task)
      return NextResponse.json({ error: "Task not found." }, { status: 404 });

    const { data: story } = await supabase
      .from("user_stories")
      .select("project_id")
      .eq("id", task.user_story_id)
      .maybeSingle();

    if (!story)
      return NextResponse.json({ error: "Story not found." }, { status: 404 });

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      !membership ||
      (membership.role !== "developer" && membership.role !== "scrum_master")
    ) {
      return NextResponse.json(
        { error: "Nimaš pravic za brisanje naloge." },
        { status: 403 },
      );
    }
    if (task.is_accepted) {
      return NextResponse.json(
        { error: "Sprejete naloge ni mogoče izbrisati." },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);
    if (deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ message: "Naloga uspešno izbrisana." });
  } catch {
    return NextResponse.json(
      { error: "Error deleting task." },
      { status: 500 },
    );
  }
}
