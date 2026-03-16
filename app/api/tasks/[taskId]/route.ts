import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   get:
 *     summary: Get a single task
 *     description: Returns a single task by ID, including assignee details.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the task
 *         example: "f6a7b8c9-d0e1-2345-fabc-678901234567"
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
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
 *                   example: "Error fetching task."
 */
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

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   patch:
 *     summary: Update a task
 *     description: >
 *       Updates a task. Supports four actions via the `action` field,
 *       or a direct status update if no action is specified.
 *
 *       **Actions:**
 *       - `accept` — Developer or Scrum Master accepts the task. Sets assignee to current user, marks as accepted, status → assigned. Only in active sprint.
 *       - `resign` — Current assignee resigns from the task. Clears assignee, marks as unaccepted, status → unassigned.
 *       - `edit` — Developer or Scrum Master edits description, estimated_hours, or assignee_id. Only if task is not yet accepted.
 *       - *(no action)* — Direct status update. Valid statuses: unassigned, assigned, in_progress, completed. If moving to in_progress without an assignee, the current user is assigned automatically.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the task
 *         example: "f6a7b8c9-d0e1-2345-fabc-678901234567"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, resign, edit]
 *                 nullable: true
 *                 description: The action to perform. If omitted, a direct status update is performed.
 *                 example: "accept"
 *               status:
 *                 type: string
 *                 enum: [unassigned, assigned, in_progress, completed]
 *                 description: Required when no action is provided
 *                 example: "in_progress"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Used with action=edit
 *                 example: "Updated task description"
 *               estimated_hours:
 *                 type: number
 *                 nullable: true
 *                 description: Used with action=edit. Must be a positive number.
 *                 example: 3
 *               assignee_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Used with action=edit
 *                 example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation failed or task action not permitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     notInSprint:
 *                       value: "Naloga ni v nobenem sprintu."
 *                     sprintNotActive:
 *                       value: "Nalogo lahko sprejmete samo v aktivnem sprintu."
 *                     alreadyAccepted:
 *                       value: "Naloga je že sprejeta."
 *                     assignedToOther:
 *                       value: "Naloga je dodeljena drugemu članu."
 *                     notOwner:
 *                       value: "Niste lastnik te naloge."
 *                     acceptedCannotEdit:
 *                       value: "Sprejete naloge ni mogoče urejati."
 *                     invalidHours:
 *                       value: "Ocena časa mora biti pozitivno število."
 *                     invalidStatus:
 *                       value: "Invalid status. Must be: unassigned, assigned, in_progress, or completed."
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
 *       403:
 *         description: User does not have permission
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     notMember:
 *                       value: "You are not a member of this project."
 *                     wrongRoleAccept:
 *                       value: "Samo razvijalci in skrbniki metodologije lahko sprejmejo nalogo."
 *                     wrongRoleEdit:
 *                       value: "Nimaš pravic za urejanje naloge."
 *                     wrongRoleStatus:
 *                       value: "Only developers and scrum masters can work on tasks."
 *       404:
 *         description: Task or story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     taskNotFound:
 *                       value: "Task not found."
 *                     storyNotFound:
 *                       value: "Story not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error updating task."
 */
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

      if (task.is_accepted) {
        return NextResponse.json(
          { error: "Naloga je že sprejeta." },
          { status: 400 },
        );
      }

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

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   delete:
 *     summary: Delete a task
 *     description: >
 *       Deletes a task by ID. Only developers and Scrum Masters can delete tasks.
 *       Accepted tasks cannot be deleted.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the task to delete
 *         example: "f6a7b8c9-d0e1-2345-fabc-678901234567"
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Naloga uspešno izbrisana."
 *       400:
 *         description: Task cannot be deleted because it is accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Sprejete naloge ni mogoče izbrisati."
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
 *       403:
 *         description: User does not have permission to delete the task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Nimaš pravic za brisanje naloge."
 *       404:
 *         description: Task or story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     taskNotFound:
 *                       value: "Task not found."
 *                     storyNotFound:
 *                       value: "Story not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error deleting task."
 */
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