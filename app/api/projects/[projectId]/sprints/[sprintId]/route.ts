import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
    sprintId: string;
  }>;
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

async function requireScrumMaster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role === "scrum_master";
}

/**
 * @swagger
 * /api/projects/{projectId}/sprints/{sprintId}:
 *   put:
 *     summary: Update a sprint
 *     description: >
 *       Updates a sprint. Only the Scrum Master of the project can perform this action.
 *       - Planned sprints (not yet started): all fields can be updated (name, goal, start_date, end_date, velocity).
 *       - Active sprints (already started, not yet ended): only velocity can be updated.
 *       - Completed sprints: cannot be updated.
 *       Start date must not be in the past, end date must be after start date,
 *       velocity must be a positive number not exceeding 100,
 *       and updated dates must not overlap with any other existing sprint.
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *       - in: path
 *         name: sprintId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the sprint to update
 *         example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - start_date
 *               - end_date
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Sprint 1"
 *               goal:
 *                 type: string
 *                 nullable: true
 *                 example: "Implement user authentication"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 description: Ignored for active sprints
 *                 example: "2024-02-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: Ignored for active sprints
 *                 example: "2024-02-14"
 *               velocity:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional. Must be a positive number, max 100.
 *                 example: 21
 *     responses:
 *       200:
 *         description: Sprint updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sprint'
 *       400:
 *         description: Validation failed or sprint is completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     completed:
 *                       value: "Zaključenega sprinta ni mogoče urejati."
 *                     missingFields:
 *                       value: "name, start_date in end_date so obvezni."
 *                     pastStartDate:
 *                       value: "Začetni datum ne sme biti v preteklosti."
 *                     invalidEndDate:
 *                       value: "Končni datum mora biti po začetnem datumu."
 *                     invalidVelocity:
 *                       value: "Hitrost mora biti pozitivno število."
 *                     velocityTooHigh:
 *                       value: "Hitrost je previsoka."
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
 *         description: User is not the Scrum Master of this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Samo Scrum Master lahko ureja sprinte."
 *       404:
 *         description: Sprint not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Sprint ne obstaja."
 *       409:
 *         description: Sprint dates overlap with another sprint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Sprint se prekriva z obstoječim sprintom."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri posodabljanju sprinta."
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { projectId, sprintId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isScrumMaster = await requireScrumMaster(supabase, user.id, projectId);
  if (!isScrumMaster)
    return NextResponse.json(
      { error: "Samo Scrum Master lahko ureja sprinte." },
      { status: 403 },
    );

  const { data: sprint } = await supabase
    .from("sprints")
    .select("id, start_date, end_date")
    .eq("id", sprintId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!sprint)
    return NextResponse.json({ error: "Sprint ne obstaja." }, { status: 404 });

  const today = getToday();
  const isActive = sprint.start_date <= today && sprint.end_date >= today;
  const isCompleted = sprint.end_date < today;

  if (isCompleted)
    return NextResponse.json(
      { error: "Zaključenega sprinta ni mogoče urejati." },
      { status: 400 },
    );

  const body = await req.json();
  const { velocity } = body;

  // Validate velocity (applies to both planned and active)
  if (velocity !== undefined && velocity !== null && velocity !== "") {
    const velocityNumber = Number(velocity);
    if (!Number.isFinite(velocityNumber) || velocityNumber <= 0)
      return NextResponse.json(
        { error: "Hitrost mora biti pozitivno število." },
        { status: 400 },
      );
    if (velocityNumber > 100)
      return NextResponse.json(
        { error: "Hitrost je previsoka." },
        { status: 400 },
      );
  }

  // Active sprint — only velocity can change
  if (isActive) {
    const { data, error } = await supabase
      .from("sprints")
      .update({ velocity: velocity ?? null })
      .eq("id", sprintId)
      .select()
      .single();

    if (error) {
      console.error("PUT /sprints/[sprintId] error:", error);
      return NextResponse.json(
        { error: "Napaka pri posodabljanju sprinta." },
        { status: 500 },
      );
    }
    return NextResponse.json(data);
  }

  // Planned sprint — full update
  const { name, goal, start_date, end_date } = body;

  if (!name || !start_date || !end_date)
    return NextResponse.json(
      { error: "name, start_date in end_date so obvezni." },
      { status: 400 },
    );

  if (start_date < today)
    return NextResponse.json(
      { error: "Začetni datum ne sme biti v preteklosti." },
      { status: 400 },
    );

  if (end_date <= start_date)
    return NextResponse.json(
      { error: "Končni datum mora biti po začetnem datumu." },
      { status: 400 },
    );

  // Overlap check — exclude current sprint
  const { data: overlapping, error: overlapError } = await supabase
    .from("sprints")
    .select("id")
    .eq("project_id", projectId)
    .neq("id", sprintId)
    .lte("start_date", end_date)
    .gte("end_date", start_date);

  if (overlapError)
    return NextResponse.json({ error: overlapError.message }, { status: 500 });

  if (overlapping && overlapping.length > 0)
    return NextResponse.json(
      { error: "Sprint se prekriva z obstoječim sprintom." },
      { status: 409 },
    );

  const { data, error } = await supabase
    .from("sprints")
    .update({
      name,
      goal: goal ?? null,
      start_date,
      end_date,
      velocity: velocity ?? null,
    })
    .eq("id", sprintId)
    .select()
    .single();

  if (error) {
    console.error("PUT /sprints/[sprintId] error:", error);
    return NextResponse.json(
      { error: "Napaka pri posodabljanju sprinta." },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

/**
 * @swagger
 * /api/projects/{projectId}/sprints/{sprintId}:
 *   delete:
 *     summary: Delete a sprint
 *     description: >
 *       Deletes a sprint that has not yet started.
 *       Only the Scrum Master of the project can perform this action.
 *       Sprints that have already started (start_date <= today) cannot be deleted.
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *       - in: path
 *         name: sprintId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the sprint to delete
 *         example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *     responses:
 *       200:
 *         description: Sprint deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sprint je bil uspešno izbrisan."
 *       400:
 *         description: Sprint has already started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Sprinta ni mogoče izbrisati, ker se je že začel."
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
 *         description: User is not the Scrum Master of this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Samo Scrum Master lahko briše sprinte."
 *       404:
 *         description: Sprint not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Sprint ne obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri brisanju sprinta."
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { projectId, sprintId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isScrumMaster = await requireScrumMaster(supabase, user.id, projectId);
  if (!isScrumMaster)
    return NextResponse.json(
      { error: "Samo Scrum Master lahko briše sprinte." },
      { status: 403 },
    );

  const { data: sprint } = await supabase
    .from("sprints")
    .select("id, start_date")
    .eq("id", sprintId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!sprint)
    return NextResponse.json({ error: "Sprint ne obstaja." }, { status: 404 });

  const today = getToday();
  if (sprint.start_date <= today)
    return NextResponse.json(
      { error: "Sprinta ni mogoče izbrisati, ker se je že začel." },
      { status: 400 },
    );

  const { error } = await supabase
    .from("sprints")
    .delete()
    .eq("id", sprintId);

  if (error) {
    console.error("DELETE /sprints/[sprintId] error:", error);
    return NextResponse.json(
      { error: "Napaka pri brisanju sprinta." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Sprint je bil uspešno izbrisan." });
}