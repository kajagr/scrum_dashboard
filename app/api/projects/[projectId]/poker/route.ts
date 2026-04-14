import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * @swagger
 * /api/projects/{projectId}/poker:
 *   get:
 *     summary: Get active poker sessions for a project
 *     description: Returns all active Planning Poker sessions for the given project. The user must be a member of the project.
 *     tags:
 *       - Planning Poker
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of active poker sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       user_story_id:
 *                         type: string
 *                         format: uuid
 *                       status:
 *                         type: string
 *                       current_round:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of the project
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Nisi član projekta." }, { status: 403 });
    }

    const { data: sessions } = await supabase
      .from("poker_sessions")
      .select("id, user_story_id, status, current_round")
      .eq("project_id", projectId)
      .eq("status", "active");

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju sej." },
      { status: 500 },
    );
  }
}
