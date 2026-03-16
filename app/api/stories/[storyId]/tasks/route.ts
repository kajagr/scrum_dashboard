import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    storyId: string;
  }>;
};

/**
 * @swagger
 * /api/stories/{storyId}/tasks:
 *   get:
 *     summary: Get all tasks for a user story
 *     description: Returns all tasks for the given user story, ordered by position ascending. Includes assignee details.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story
 *         example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
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
 *                   example: "Napaka pri pridobivanju nalog."
 *
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "f6a7b8c9-d0e1-2345-fabc-678901234567"
 *         user_story_id:
 *           type: string
 *           format: uuid
 *           example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *         title:
 *           type: string
 *           example: "Implement login form"
 *         description:
 *           type: string
 *           example: "Implement login form"
 *         estimated_hours:
 *           type: number
 *           example: 4
 *         status:
 *           type: string
 *           enum: [unassigned, assigned, active, done]
 *           example: "unassigned"
 *         assignee_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *         assignee:
 *           nullable: true
 *           allOf:
 *             - $ref: '#/components/schemas/UserSummary'
 *         position:
 *           type: integer
 *           example: 0
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

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
      .eq("user_story_id", storyId)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju nalog." },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/stories/{storyId}/tasks:
 *   post:
 *     summary: Create a new task
 *     description: >
 *       Creates a new task for the given user story.
 *       Only Scrum Masters and developers can create tasks.
 *       Tasks can only be added to stories that are assigned to an active sprint and are not yet done.
 *       If an assignee is provided, they must be a developer or scrum master in the project.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story
 *         example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - estimated_hours
 *             properties:
 *               description:
 *                 type: string
 *                 description: Task description (also used as title)
 *                 example: "Implement login form"
 *               estimated_hours:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Estimated hours to complete the task, must be a positive number
 *                 example: 4
 *               assignee_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Optional. Must be a developer or scrum master in the project.
 *                 example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation failed or story/sprint conditions not met
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     storyDone:
 *                       value: "Naloge ni mogoče dodati k že realizirani zgodbi."
 *                     notInSprint:
 *                       value: "Naloge je mogoče dodati samo zgodbam v aktivnem sprintu."
 *                     sprintNotActive:
 *                       value: "Naloge je mogoče dodati samo zgodbam v aktivnem sprintu."
 *                     missingDescription:
 *                       value: "Opis naloge je obvezen."
 *                     missingHours:
 *                       value: "Ocena časa je obvezna."
 *                     invalidHours:
 *                       value: "Ocena časa mora biti pozitivna številka."
 *                     assigneeNotMember:
 *                       value: "Izbrani član ni del tega projekta."
 *                     assigneeWrongRole:
 *                       value: "Naloge lahko prevzamejo samo razvijalci in skrbniki metodologije."
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
 *         description: User is not a project member or does not have the required role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     notMember:
 *                       value: "Nisi član tega projekta."
 *                     wrongRole:
 *                       value: "Samo skrbnik metodologije in razvijalci lahko dodajajo naloge."
 *       404:
 *         description: User story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Uporabniška zgodba ne obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri ustvarjanju naloge."
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, sprint_id, status")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError) {
      return NextResponse.json({ error: storyError.message }, { status: 500 });
    }

    if (!story) {
      return NextResponse.json(
        { error: "Uporabniška zgodba ne obstaja." },
        { status: 404 }
      );
    }

    if (story.status === "done") {
      return NextResponse.json(
        { error: "Naloge ni mogoče dodati k že realizirani zgodbi." },
        { status: 400 }
      );
    }

    if (!story.sprint_id) {
      return NextResponse.json(
        { error: "Naloge je mogoče dodati samo zgodbam v aktivnem sprintu." },
        { status: 400 }
      );
    }

    const { data: sprint, error: sprintError } = await supabase
      .from("sprints")
      .select("id, status, start_date, end_date")
      .eq("id", story.sprint_id)
      .maybeSingle();

    if (sprintError || !sprint) {
      return NextResponse.json(
        { error: "Sprint ne obstaja." },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const sprintStatus =
      today < sprint.start_date ? "planned" :
      today > sprint.end_date ? "completed" : "active";

    if (sprintStatus !== "active") {
      return NextResponse.json(
        { error: "Naloge je mogoče dodati samo zgodbam v aktivnem sprintu." },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "Nisi član tega projekta." },
        { status: 403 }
      );
    }

    if (membership.role !== "scrum_master" && membership.role !== "developer") {
      return NextResponse.json(
        { error: "Samo skrbnik metodologije in razvijalci lahko dodajajo naloge." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const description = body.description?.trim();
    const estimatedHours = body.estimated_hours;
    const assigneeId = body.assignee_id || null;

    if (!description) {
      return NextResponse.json(
        { error: "Opis naloge je obvezen." },
        { status: 400 }
      );
    }

    if (estimatedHours === undefined || estimatedHours === null || estimatedHours === "") {
      return NextResponse.json(
        { error: "Ocena časa je obvezna." },
        { status: 400 }
      );
    }

    const hours = Number(estimatedHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json(
        { error: "Ocena časa mora biti pozitivna številka." },
        { status: 400 }
      );
    }

    if (assigneeId) {
      const { data: assigneeMembership, error: assigneeError } = await supabase
        .from("project_members")
        .select("id, role")
        .eq("project_id", story.project_id)
        .eq("user_id", assigneeId)
        .maybeSingle();

      if (assigneeError) {
        return NextResponse.json({ error: assigneeError.message }, { status: 500 });
      }

      if (!assigneeMembership) {
        return NextResponse.json(
          { error: "Izbrani član ni del tega projekta." },
          { status: 400 }
        );
      }

      if (assigneeMembership.role !== "developer" && assigneeMembership.role !== "scrum_master") {
        return NextResponse.json(
          { error: "Naloge lahko prevzamejo samo razvijalci in skrbniki metodologije." },
          { status: 400 }
        );
      }
    }

    const { data: tasks } = await supabase
      .from("tasks")
      .select("position")
      .eq("user_story_id", storyId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = tasks && tasks.length > 0 ? tasks[0].position + 1 : 0;

    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        user_story_id: storyId,
        title: description,
        description: description,
        estimated_hours: hours,
        assignee_id: assigneeId,
        status: "unassigned",
        position: nextPosition,
      })
      .select(`
        *,
        assignee:users(id, first_name, last_name, email)
      `)
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri ustvarjanju naloge." },
      { status: 500 }
    );
  }
}