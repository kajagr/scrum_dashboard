import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * @swagger
 * /api/projects/{projectId}/wall:
 *   get:
 *     summary: Get wall posts for a project
 *     description: >
 *       Returns all wall posts for the given project, ordered by creation date descending.
 *       Only project members can view wall posts.
 *       Each post includes the author's name and the number of comments.
 *     tags:
 *       - Wall
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
 *         description: List of wall posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WallPost'
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error fetching wall posts."
 *
 * components:
 *   schemas:
 *     WallPost:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *         content:
 *           type: string
 *           example: "Danes smo zaključili Sprint 1!"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
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
 *         comment_count:
 *           type: integer
 *           description: Number of comments on this post
 *           example: 3
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("project_wall_posts")
      .select(`
        id,
        content,
        created_at,
        author:users(id, first_name, last_name),
        post_comments(count)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const posts = (data ?? []).map((post: any) => ({
      ...post,
      comment_count: post.post_comments?.[0]?.count ?? 0,
      post_comments: undefined,
    }));

    return NextResponse.json(posts);
  } catch {
    return NextResponse.json({ error: "Error fetching wall posts." }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/projects/{projectId}/wall:
 *   post:
 *     summary: Create a wall post
 *     description: >
 *       Creates a new wall post in the project.
 *       Only project members can post on the wall.
 *     tags:
 *       - Wall
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Content of the wall post, cannot be empty
 *                 example: "Danes smo zaključili Sprint 1!"
 *     responses:
 *       201:
 *         description: Wall post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WallPost'
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error creating wall post."
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
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
      .from("project_wall_posts")
      .insert({ project_id: projectId, user_id: user.id, content })
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

    return NextResponse.json({ ...data, comment_count: 0 }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error creating wall post." }, { status: 500 });
  }
}