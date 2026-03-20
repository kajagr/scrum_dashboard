import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

const ALLOWED_PRIORITIES = [
  "must_have",
  "should_have",
  "could_have",
  "wont_have",
] as const;

/**
 * @swagger
 * /api/projects/{projectId}/stories:
 *   get:
 *     summary: Get all user stories for a project
 *     description: Returns all user stories for the given project, ordered by position ascending.
 *     tags:
 *       - Stories
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
 *         description: List of user stories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserStory'
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
 *         description: User does not have permission to view user stories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You do not have permission to view user stories."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An error occurred while fetching user stories."
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
      error: useError,
    } = await supabase.auth.getUser();

    if (useError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_stories")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (error) {
      if (
        error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "You do not have permission to view user stories." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "An error occurred while fetching user stories." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/projects/{projectId}/stories:
 *   post:
 *     summary: Create a new user story
 *     description: >
 *       Creates a new user story in the project backlog.
 *       Only Product Owners and Scrum Masters have permission to create stories (enforced via RLS).
 *       The story is automatically placed at the end of the backlog based on position.
 *       Story titles must be unique within a project.
 *     tags:
 *       - Stories
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
 *               - title
 *               - priority
 *               - business_value
 *             properties:
 *               title:
 *                 type: string
 *                 description: Must be unique within the project
 *                 example: "As a user, I want to log in"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "User should be able to log in with email and password."
 *               acceptance_criteria:
 *                 type: string
 *                 nullable: true
 *                 example: "Login form is visible. Error shown on wrong credentials."
 *               priority:
 *                 type: string
 *                 enum: [must_have, should_have, could_have, wont_have]
 *                 example: "must_have"
 *               business_value:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 10
 *               story_points:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 0
 *                 example: 3
 *     responses:
 *       201:
 *         description: User story created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStory'
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
 *                       value: "title, priority and business_value are required."
 *                     invalidPriority:
 *                       value: "Invalid priority value."
 *                     invalidBusinessValue:
 *                       value: "business_value must be between 1 and 100."
 *                     invalidStoryPoints:
 *                       value: "story_points must be 0 or greater."
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
 *         description: User does not have permission to create a user story
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You do not have permission to create a user story."
 *       409:
 *         description: A user story with this title already exists in the project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "A user story with this title already exists."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An error occurred while creating the user story."
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

    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const acceptanceCriteria = body.acceptance_criteria?.trim() || null;
    const priority = body.priority;
    const businessValue = body.business_value;
    const storyPoints = body.story_points ?? null;

    if (
      !title ||
      !priority ||
      businessValue === undefined ||
      businessValue === null
    ) {
      return NextResponse.json(
        { error: "title, priority and business_value are required." },
        { status: 400 },
      );
    }

    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority value." },
        { status: 400 },
      );
    }

    const businessValueNumber = Number(businessValue);

    if (
      !Number.isFinite(businessValueNumber) ||
      businessValueNumber <= 0 ||
      businessValueNumber > 100
    ) {
      return NextResponse.json(
        { error: "business_value must be between 1 and 100." },
        { status: 400 },
      );
    }

    let storyPointsNumber: number | null = null;

    if (storyPoints !== null && storyPoints !== "") {
      storyPointsNumber = Number(storyPoints);

      if (!Number.isFinite(storyPointsNumber) || storyPointsNumber < 0) {
        return NextResponse.json(
          { error: "story_points must be 0 or greater." },
          { status: 400 },
        );
      }
    }

    const { data: existingStory, error: duplicateCheckError } = await supabase
      .from("user_stories")
      .select("id")
      .eq("project_id", projectId)
      .eq("title", title)
      .is("deleted_at", null)
      .maybeSingle();

    if (duplicateCheckError) {
      return NextResponse.json(
        { error: duplicateCheckError.message },
        { status: 500 },
      );
    }

    if (existingStory) {
      return NextResponse.json(
        { error: "A user story with this title already exists." },
        { status: 409 },
      );
    }

    const { data: lastStory, error: lastStoryError } = await supabase
      .from("user_stories")
      .select("position")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastStoryError) {
      return NextResponse.json(
        { error: lastStoryError.message },
        { status: 500 },
      );
    }

    const nextPosition = lastStory ? lastStory.position + 1 : 0;

    const { data, error } = await supabase
      .from("user_stories")
      .insert({
        project_id: projectId,
        title,
        description,
        acceptance_criteria: acceptanceCriteria,
        priority,
        business_value: businessValueNumber,
        story_points: storyPointsNumber,
        status: "backlog",
        position: nextPosition,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (
        error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "You do not have permission to create a user story." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "An error occurred while creating the user story." },
      { status: 500 },
    );
  }
}
