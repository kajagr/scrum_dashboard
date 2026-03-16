import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get tasks for a user story
 *     description: Returns all tasks for the given user story, ordered by position ascending.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: query
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
 *       400:
 *         description: Missing storyId query parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "storyId is required"
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
 *                   example: "Unexpected error occurred."
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId");

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!storyId) {
    return NextResponse.json({ error: "storyId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_story_id", storyId)
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     description: >
 *       Creates a new task for a user story.
 *       The task is automatically placed at the end based on position.
 *       Note: For production task creation with full validation (sprint checks, role checks, assignee validation),
 *       use POST /api/stories/{storyId}/tasks instead.
 *     tags:
 *       - Tasks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_story_id
 *               - title
 *             properties:
 *               user_story_id:
 *                 type: string
 *                 format: uuid
 *                 example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *               title:
 *                 type: string
 *                 example: "Implement login form"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Build the login form with email and password fields."
 *               estimated_hours:
 *                 type: number
 *                 nullable: true
 *                 example: 4
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "user_story_id and title are required"
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
 *                   example: "Unexpected error occurred."
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { user_story_id, title, description, estimated_hours } = body;

  if (!user_story_id || !title) {
    return NextResponse.json({ error: "user_story_id and title are required" }, { status: 400 });
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("position")
    .eq("user_story_id", user_story_id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = tasks && tasks.length > 0 ? tasks[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_story_id,
      title,
      description,
      estimated_hours,
      status: "todo",
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}