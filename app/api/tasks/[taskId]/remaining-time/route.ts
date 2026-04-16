import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/**
 * @swagger
 * /api/tasks/{taskId}/remaining-time:
 *   patch:
 *     summary: Update remaining time estimate for a task
 *     description: >
 *       Sets the estimated remaining time (in hours) needed to complete the task.
 *       Only the current assignee (who has accepted the task) can update this.
 *       Value must be >= 0.
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
 *             required: [remaining_time]
 *             properties:
 *               remaining_time:
 *                 type: number
 *                 minimum: 0
 *                 description: Estimated remaining hours. Must be >= 0.
 *                 example: 1.5
 *     responses:
 *       200:
 *         description: Remaining time updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 remaining_time:
 *                   type: number
 *                   nullable: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Preostali čas mora biti 0 ali več."
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
 *         description: Task not accepted by current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Samo sprejemnik naloge lahko posodobi preostali čas."
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Naloga ni bila najdena."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri posodabljanju preostalega časa."
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

    const body = await request.json();
    const remainingTime = Number(body.remaining_time);

    if (body.remaining_time === undefined || body.remaining_time === null || isNaN(remainingTime) || remainingTime < 0) {
      return NextResponse.json(
        { error: "Preostali čas mora biti 0 ali več." },
        { status: 400 },
      );
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, assignee_id, is_accepted")
      .eq("id", taskId)
      .is("deleted_at", null)
      .maybeSingle();

    if (taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task)
      return NextResponse.json(
        { error: "Naloga ni bila najdena." },
        { status: 404 },
      );

    if (!task.is_accepted || task.assignee_id !== user.id) {
      return NextResponse.json(
        { error: "Samo sprejemnik naloge lahko posodobi preostali čas." },
        { status: 403 },
      );
    }

    const taskUpdate: Record<string, unknown> = {
      remaining_time: remainingTime,
      updated_at: new Date().toISOString(),
    };
    if (remainingTime === 0) {
      taskUpdate.status = "completed";
    }

    const { data: updated, error: updateError } = await supabase
      .from("tasks")
      .update(taskUpdate)
      .eq("id", taskId)
      .select("id, remaining_time, status")
      .single();

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri posodabljanju preostalega časa." },
      { status: 500 },
    );
  }
}
