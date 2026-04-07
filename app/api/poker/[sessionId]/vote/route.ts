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
 * /api/poker/{sessionId}/vote:
 *   post:
 *     summary: Submit a vote in a Planning Poker session
 *     description: >
 *       Submits an estimate vote for the current round.
 *       All project members (scrum_master and developer) can vote.
 *       Each member can only vote once per round.
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
 *               - estimate
 *             properties:
 *               estimate:
 *                 type: number
 *                 example: 5
 *     responses:
 *       201:
 *         description: Vote submitted successfully
 *       400:
 *         description: Already voted or invalid estimate
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a project member
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

    if (!membership || !["scrum_master", "developer"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Nisi član projekta." },
        { status: 403 },
      );
    }

    // Preveri če je že glasoval v tem krogu
    const { data: existingVote } = await supabase
      .from("poker_votes")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .eq("round_number", session.current_round)
      .maybeSingle();

    if (existingVote) {
      return NextResponse.json(
        { error: "V tem krogu si že glasoval." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { estimate } = body;

    const VALID_ESTIMATES = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, -1]; // -1 = "?"
    if (estimate === undefined || estimate === null || !VALID_ESTIMATES.includes(Number(estimate))) {
      return NextResponse.json(
        { error: "Neveljavna ocena." },
        { status: 400 },
      );
    }

    const { data: vote, error } = await supabaseAdmin
      .from("poker_votes")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        round_number: session.current_round,
        estimate: Number(estimate),
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(vote, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri oddaji glasovanja." },
      { status: 500 },
    );
  }
}