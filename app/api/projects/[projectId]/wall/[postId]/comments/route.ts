import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ postId: string }>;
};

/**
 * @swagger
 * /api/wall/{postId}/comments:
 *   get:
 *     summary: Get comments for a wall post
 *     description: >
 *       Returns all comments for the given wall post, ordered by creation date ascending.
 *       Only project members can view comments.
 *     tags:
 *       - Wall
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the wall post
 *         example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WallComment'
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
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Post not found."
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
 *
 * components:
 *   schemas:
 *     WallComment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *         content:
 *           type: string
 *           example: "Odlično delo!"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T11:00:00Z"
 *         author:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *               example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *             first_name:
 *               type: string
 *               example: "Janez"
 *             last_name:
 *               type: string
 *               example: "Novak"
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { postId } = await context.params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: post } = await supabase
      .from("project_wall_posts")
      .select("id, project_id")
      .eq("id", postId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", post.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("post_comments")
      .select(`
        id,
        content,
        created_at,
        author:users(id, first_name, last_name)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Error fetching comments." }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/wall/{postId}/comments:
 *   post:
 *     summary: Create a comment on a wall post
 *     description: >
 *       Adds a new comment to a wall post.
 *       Only project members can comment.
 *     tags:
 *       - Wall
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the wall post to comment on
 *         example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
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
 *                 description: Content of the comment, cannot be empty
 *                 example: "Odlično delo!"
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WallComment'
 *       400:
 *         description: Content is empty
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Content cannot be empty."
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
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Post not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error creating comment."
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { postId } = await context.params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: post } = await supabase
      .from("project_wall_posts")
      .select("id, project_id")
      .eq("id", postId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", post.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    }

    const body = await req.json();
    const content = body.content?.trim();

    if (!content) {
      return NextResponse.json({ error: "Content cannot be empty." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        content,
      })
      .select(`
        id,
        content,
        created_at,
        author:users(id, first_name, last_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error creating comment." }, { status: 500 });
  }
}