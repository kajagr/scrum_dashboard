import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

function getSprintStatus(startDate: string, endDate: string) {
  const today = new Date().toISOString().split("T")[0];

  if (today < startDate) return "planned";
  if (today > endDate) return "completed";
  return "active";
}

/**
 * @swagger
 * /api/projects/{projectId}/sprints:
 *   get:
 *     summary: Get all sprints for a project
 *     description: >
 *       Returns all sprints for the given project, ordered by start date ascending.
 *       Sprint status is computed dynamically based on today's date:
 *       "planned" (not yet started), "active" (currently running), or "completed" (ended).
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
 *     responses:
 *       200:
 *         description: List of sprints with computed status
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sprint'
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
 *                   example: "Napaka pri pridobivanju sprintov."
 *
 * components:
 *   schemas:
 *     Sprint:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *         project_id:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *         name:
 *           type: string
 *           example: "Sprint 1"
 *         goal:
 *           type: string
 *           nullable: true
 *           example: "Implement user authentication"
 *         start_date:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         end_date:
 *           type: string
 *           format: date
 *           example: "2024-01-14"
 *         velocity:
 *           type: integer
 *           nullable: true
 *           example: 21
 *         status:
 *           type: string
 *           enum: [planned, active, completed]
 *           example: "active"
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("sprints")
      .select("*")
      .eq("project_id", projectId)
      .order("start_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sprintsWithUpdatedStatus = (data ?? []).map((sprint) => ({
      ...sprint,
      status: getSprintStatus(sprint.start_date, sprint.end_date),
    }));

    return NextResponse.json(sprintsWithUpdatedStatus, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju sprintov." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/projects/{projectId}/sprints:
 *   post:
 *     summary: Create a new sprint
 *     description: >
 *       Creates a new sprint for the given project.
 *       Start date must not be in the past, end date must be after start date,
 *       velocity must be a positive number not exceeding 100,
 *       and the sprint must not overlap with any existing sprint.
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
 *                 description: Must not be in the past
 *                 example: "2024-02-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: Must be after start_date
 *                 example: "2024-02-14"
 *               velocity:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional. Must be a positive number, max 100.
 *                 example: 21
 *     responses:
 *       201:
 *         description: Sprint created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sprint'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missingFields:
 *                       value: "name, start_date in end_date so obvezni."
 *                     pastStartDate:
 *                       value: "Začetni datum ne sme biti v preteklosti."
 *                     invalidEndDate:
 *                       value: "Končni datum mora biti po začetnem."
 *                     invalidVelocity:
 *                       value: "Velocity mora biti pozitivna številka."
 *                     velocityTooHigh:
 *                       value: "Velocity je previsok."
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
 *         description: User does not have permission to create a sprint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Nimaš pravic za ustvarjanje sprinta."
 *       409:
 *         description: Sprint overlaps with an existing sprint
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
 *                   example: "Napaka pri ustvarjanju sprinta."
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, goal, start_date, end_date, velocity } = body;

    if (!name || !start_date || !end_date) {
      return NextResponse.json(
        { error: "name, start_date in end_date so obvezni." },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().split("T")[0];

    if (start_date < today) {
      return NextResponse.json(
        { error: "Začetni datum ne sme biti v preteklosti." },
        { status: 400 },
      );
    }

    if (end_date <= start_date) {
      return NextResponse.json(
        { error: "Končni datum mora biti po začetnem." },
        { status: 400 },
      );
    }

    if (velocity !== undefined && velocity !== null && velocity !== "") {
      const velocityNumber = Number(velocity);

      if (!Number.isFinite(velocityNumber) || velocityNumber <= 0) {
        return NextResponse.json(
          { error: "Velocity mora biti pozitivna številka." },
          { status: 400 },
        );
      }

      if (velocityNumber > 100) {
        return NextResponse.json(
          { error: "Velocity je previsok." },
          { status: 400 },
        );
      }
    }

    const { data: overlappingSprints, error: overlapError } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", projectId)
      .lte("start_date", end_date)
      .gte("end_date", start_date);

    if (overlapError) {
      return NextResponse.json(
        { error: overlapError.message },
        { status: 500 },
      );
    }

    if (overlappingSprints && overlappingSprints.length > 0) {
      return NextResponse.json(
        { error: "Sprint se prekriva z obstoječim sprintom." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("sprints")
      .insert({
        project_id: projectId,
        name,
        goal,
        start_date,
        end_date,
        velocity: velocity ?? null,
        status: "planned",
      })
      .select()
      .single();

    if (error) {
      if (
        error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za ustvarjanje sprinta." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri ustvarjanju sprinta." },
      { status: 500 },
    );
  }
}