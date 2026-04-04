import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

/**
 * @swagger
 * /api/stories/{storyId}/comments:
 *   get:
 *     summary: Get comments for a user story
 *     description: >
 *       Returns all comments for a user story, ordered by creation date ascending.
 *       Only project members can view comments.
 *     tags:
 *       - Stories
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story
 *         example: "c3d4e5f6-a7b8-9012-cdef-345678901234"
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     example: "e5f6a7b8-c9d0-1234-efab-567890123456"
 *                   content:
 *                     type: string
 *                     example: "This story needs more detail in the acceptance criteria."
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00Z"
 *                   author:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                       first_name:
 *                         type: string
 *                         example: "Janez"
 *                       last_name:
 *                         type: string
 *                         example: "Novak"
 *                       username:
 *                         type: string
 *                         example: "janez.novak"
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
 *         description: User is not a member of this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You are not a member of this project."
 *       404:
 *         description: Story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Story not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error fetching comments."
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: story } = await supabase
      .from("user_stories")
      .select("id, project_id")
      .eq("id", storyId)
      .maybeSingle();

    if (!story)
      return NextResponse.json({ error: "Story not found." }, { status: 404 });

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership)
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 },
      );

    const { data: comments, error } = await supabase
      .from("story_comments")
      .select(
        `
        id,
        content,
        created_at,
        author:users(id, first_name, last_name, username)
      `,
      )
      .eq("user_story_id", storyId)
      .order("created_at", { ascending: true });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(comments ?? []);
  } catch {
    return NextResponse.json(
      { error: "Error fetching comments." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/stories/{storyId}/comments:
 *   post:
 *     summary: Add a comment to a user story
 *     description: >
 *       Adds a new comment to a user story.
 *       Only project members can add comments.
 *       Comment content cannot be empty.
 *     tags:
 *       - Stories
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story
 *         example: "c3d4e5f6-a7b8-9012-cdef-345678901234"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The comment text. Cannot be empty.
 *                 example: "This story needs more detail in the acceptance criteria."
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "e5f6a7b8-c9d0-1234-efab-567890123456"
 *                 content:
 *                   type: string
 *                   example: "This story needs more detail in the acceptance criteria."
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 author:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                     first_name:
 *                       type: string
 *                       example: "Janez"
 *                     last_name:
 *                       type: string
 *                       example: "Novak"
 *                     username:
 *                       type: string
 *                       example: "janez.novak"
 *       400:
 *         description: Comment content is empty
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Comment content cannot be empty."
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
 *         description: User is not a member of this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You are not a member of this project."
 *       404:
 *         description: Story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Story not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error adding comment."
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: story } = await supabase
      .from("user_stories")
      .select("id, project_id")
      .eq("id", storyId)
      .maybeSingle();

    if (!story)
      return NextResponse.json({ error: "Story not found." }, { status: 404 });

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership)
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 },
      );

    const body = await req.json();
    const content = body.content?.trim();

    if (!content)
      return NextResponse.json(
        { error: "Comment content cannot be empty." },
        { status: 400 },
      );

    const { data: comment, error } = await supabase
      .from("story_comments")
      .insert({ user_story_id: storyId, user_id: user.id, content })
      .select(
        `
        id,
        content,
        created_at,
        author:users(id, first_name, last_name, username)
      `,
      )
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error adding comment." },
      { status: 500 },
    );
  }
}