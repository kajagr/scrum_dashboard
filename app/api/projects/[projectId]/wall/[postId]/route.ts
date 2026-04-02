import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; postId: string }>;
};

/**
 * @swagger
 * /api/projects/{projectId}/wall/{postId}:
 *   delete:
 *     summary: Delete a wall post
 *     description: >
 *       Deletes a wall post and all its comments (cascade).
 *       Only the Scrum Master of the project can delete wall posts.
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
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the wall post to delete
 *         example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Post deleted successfully."
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
 *         description: User is not a member or does not have the required role
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
 *                     wrongRole:
 *                       value: "Only the Scrum Master can delete wall posts."
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
 *                   example: "Error deleting post."
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId, postId } = await context.params;

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

    if (membership.role !== "scrum_master") {
      return NextResponse.json({ error: "Only the Scrum Master can delete wall posts." }, { status: 403 });
    }

    const { data: post } = await supabase
      .from("project_wall_posts")
      .select("id")
      .eq("id", postId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const { error } = await supabase
      .from("project_wall_posts")
      .delete()
      .eq("id", postId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Post deleted successfully." });
  } catch {
    return NextResponse.json({ error: "Error deleting post." }, { status: 500 });
  }
}