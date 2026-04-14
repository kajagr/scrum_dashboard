import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

/**
 * @swagger
 * /api/poker/{sessionId}/complete:
 *   post:
 *     summary: Complete a Planning Poker session
 *     description: >
 *       Completes the session and saves the final estimate.
 *       Only the Scrum Master can complete the session.
 *       Updates story_points on the user story.
 *     tags:
 *       - Planning Poker
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - final_estimate
 *             properties:
 *               final_estimate:
 *                 type: number
 *                 example: 5
 *     responses:
 *       200:
 *         description: Session completed successfully
 *       400:
 *         description: Invalid estimate or session not active
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a scrum master
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: session } = await supabase
      .from("poker_sessions")
      .select("id, project_id, user_story_id, status, current_round, absent_member_ids")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Seja ne obstaja." }, { status: 404 });
    }

    if (session.status !== "active") {
      return NextResponse.json({ error: "Seja ni aktivna." }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", session.project_id)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!membership || membership.role !== "scrum_master") {
      return NextResponse.json(
        { error: "Samo skrbnik metodologije lahko zaključi sejo." },
        { status: 403 },
      );
    }

    // Preveri da so vsi glasovali v trenutnem krogu
    const { data: allMembers } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", session.project_id)
      .in("role", ["scrum_master", "developer"])
      .is("removed_at", null);

    const { data: currentVotes } = await supabase
      .from("poker_votes")
      .select("user_id")
      .eq("session_id", sessionId)
      .eq("round_number", session.current_round);

    const absentSet = new Set<string>(session.absent_member_ids ?? []);
    const activeMemberIds = (allMembers ?? [])
      .map((m) => m.user_id)
      .filter((id) => !absentSet.has(id));
    const votedIds = new Set(currentVotes?.map((v) => v.user_id) ?? []);
    const allVoted = activeMemberIds.every((id) => votedIds.has(id));

    if (!allVoted) {
      return NextResponse.json(
        { error: "Niso vsi člani oddali glasovanja." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { final_estimate } = body;

    if (final_estimate === undefined || final_estimate === null || isNaN(Number(final_estimate)) || Number(final_estimate) < 0) {
      return NextResponse.json(
        { error: "Neveljavna končna ocena." },
        { status: 400 },
      );
    }

    const finalEstimateNum = Number(final_estimate);

    // Zaključi sejo
    const { error: sessionError } = await supabaseAdmin
      .from("poker_sessions")
      .update({
        status: "completed",
        final_estimate: finalEstimateNum,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    // Posodobi story_points na zgodbi
    const { error: storyError } = await supabaseAdmin
      .from("user_stories")
      .update({ story_points: finalEstimateNum })
      .eq("id", session.user_story_id);

    if (storyError) {
      return NextResponse.json({ error: storyError.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Seja uspešno zaključena.", final_estimate: finalEstimateNum },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Napaka pri zaključevanju seje." },
      { status: 500 },
    );
  }
}