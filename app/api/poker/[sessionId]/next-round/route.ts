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
 * /api/poker/{sessionId}/next-round:
 *   post:
 *     summary: Start the next round of Planning Poker
 *     description: >
 *       Advances the session to the next round.
 *       Only the Scrum Master can start a new round.
 *       All members must have voted in the current round.
 *       Maximum 3 rounds allowed.
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
 *         description: Round advanced successfully
 *       400:
 *         description: Not all members voted or max rounds reached
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
      .select("id, project_id, status, current_round")
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
        { error: "Samo skrbnik metodologije lahko začne nov krog." },
        { status: 403 },
      );
    }

    if (session.current_round >= 3) {
      return NextResponse.json(
        { error: "Doseženo je maksimalno število krogov (3)." },
        { status: 400 },
      );
    }

    // Preveri da so vsi člani glasovali
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

    const memberIds = new Set(allMembers?.map((m) => m.user_id) ?? []);
    const votedIds = new Set(currentVotes?.map((v) => v.user_id) ?? []);
    const allVoted = [...memberIds].every((id) => votedIds.has(id));

    if (!allVoted) {
      return NextResponse.json(
        { error: "Niso vsi člani oddali glasovanja." },
        { status: 400 },
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from("poker_sessions")
      .update({ current_round: session.current_round + 1 })
      .eq("id", sessionId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri prehodu na naslednji krog." },
      { status: 500 },
    );
  }
}