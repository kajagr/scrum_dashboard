import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

/**
 * @swagger
 * /api/poker/{sessionId}:
 *   get:
 *     summary: Get Planning Poker session state
 *     description: >
 *       Returns the current state of a Planning Poker session.
 *       Votes are hidden until all members have voted in the current round.
 *       After round 3, a median estimate is suggested.
 *     tags:
 *       - Planning Poker
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session state
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a project member
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: session } = await supabase
      .from("poker_sessions")
      .select("id, project_id, user_story_id, status, current_round, final_estimate, created_by, created_at, completed_at, absent_member_ids")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Seja ne obstaja." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", session.project_id)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Nisi član projekta." }, { status: 403 });
    }

    // Vsi aktivni člani projekta (scrum_master + developer)
    const { data: allMembers } = await supabase
      .from("project_members")
      .select("user_id, role, user:users(id, first_name, last_name, email)")
      .eq("project_id", session.project_id)
      .in("role", ["scrum_master", "developer"])
      .is("removed_at", null);

    const members = allMembers ?? [];
    const absentSet = new Set<string>(session.absent_member_ids ?? []);

    // Glasovi trenutnega kroga
    const { data: currentVotes } = await supabase
      .from("poker_votes")
      .select("user_id, estimate")
      .eq("session_id", sessionId)
      .eq("round_number", session.current_round);

    const votes = currentVotes ?? [];
    const votedUserIds = new Set(votes.map((v) => v.user_id));
    const activeMembers = members.filter((m) => !absentSet.has(m.user_id));
    const allVoted = activeMembers.length > 0 && activeMembers.every((m) => votedUserIds.has(m.user_id));

    // Ocene so vidne samo ko so vsi glasovali
    const membersWithVotes = members.map((m) => {
      const vote = votes.find((v) => v.user_id === m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        user: m.user,
        has_voted: votedUserIds.has(m.user_id),
        estimate: allVoted ? (vote?.estimate ?? null) : null,
        is_absent: absentSet.has(m.user_id),
      };
    });

    // Izračun predloga po 3. krogu ali ko so vsi glasovali z enako oceno
    let suggested_estimate: number | null = null;
    if (allVoted) {
      const estimates = votes.map((v) => Number(v.estimate)).sort((a, b) => a - b);
      const allSame = estimates.every((e) => e === estimates[0]);

      if (allSame || session.current_round >= 3) {
        const mid = Math.floor(estimates.length / 2);
        suggested_estimate = estimates.length % 2 !== 0
          ? estimates[mid]
          : Math.round((estimates[mid - 1] + estimates[mid]) / 2);
      }
    }

    // Glasovi vseh krogov (za zgodovino)
    const { data: allVotes } = await supabase
      .from("poker_votes")
      .select("user_id, estimate, round_number")
      .eq("session_id", sessionId);

    return NextResponse.json({
      session: {
        id: session.id,
        user_story_id: session.user_story_id,
        project_id: session.project_id,
        status: session.status,
        current_round: session.current_round,
        final_estimate: session.final_estimate,
        completed_at: session.completed_at,
        absent_member_ids: session.absent_member_ids ?? [],
      },
      members: membersWithVotes,
      all_voted: allVoted,
      suggested_estimate,
      votes_history: allVotes ?? [],
      my_vote: votes.find((v) => v.user_id === user.id)?.estimate ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju stanja seje." },
      { status: 500 },
    );
  }
}