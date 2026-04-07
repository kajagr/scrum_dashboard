import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

/**
 * @swagger
 * /api/stories/{storyId}/poker:
 *   post:
 *     summary: Start a Planning Poker session
 *     description: >
 *       Starts a new Planning Poker session for an unassigned user story.
 *       Only the Scrum Master can start a session.
 *       The story must not be assigned to a sprint and must not have an active session.
 *     tags:
 *       - Planning Poker
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Session created successfully
 *       400:
 *         description: Story is assigned to a sprint or session already active
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a scrum master
 *       404:
 *         description: Story not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { storyId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: story } = await supabase
        .from("user_stories")
        .select("id, project_id, sprint_id, status")
        .eq("id", storyId)
        .maybeSingle();

    if (!story) {
      return NextResponse.json({ error: "Zgodba ne obstaja." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!membership || membership.role !== "scrum_master") {
      return NextResponse.json(
        { error: "Samo skrbnik metodologije lahko začne Planning Poker." },
        { status: 403 },
      );
    }

    if (story.sprint_id) {
    return NextResponse.json(
        { error: "Zgodba je že dodeljena sprintu." },
        { status: 400 },
    );
    }

    if (story.status === "done") {
    return NextResponse.json(
        { error: "Zaključenih zgodb ni mogoče ocenjevati." },
        { status: 400 },
    );
    }

    // Preveri aktivno sesijo
    const { data: activeSession } = await supabase
      .from("poker_sessions")
      .select("id")
      .eq("user_story_id", storyId)
      .eq("status", "active")
      .maybeSingle();

    if (activeSession) {
      return NextResponse.json(activeSession, { status: 200 });
    }

    const { data: session, error } = await supabaseAdmin
      .from("poker_sessions")
      .insert({
        user_story_id: storyId,
        project_id: story.project_id,
        status: "active",
        current_round: 1,
        created_by: user.id,
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(session, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri ustvarjanju seje." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/stories/{storyId}/poker:
 *   get:
 *     summary: Get active poker session for a story
 *     description: Returns the active poker session for a story if one exists.
 *     tags:
 *       - Planning Poker
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Active session or null
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Story not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { storyId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: story } = await supabase
      .from("user_stories")
      .select("id, project_id")
      .eq("id", storyId)
      .maybeSingle();

    if (!story) {
      return NextResponse.json({ error: "Zgodba ne obstaja." }, { status: 404 });
    }

    const { data: session } = await supabase
      .from("poker_sessions")
      .select("id, status, current_round")
      .eq("user_story_id", storyId)
      .eq("status", "active")
      .maybeSingle();

    return NextResponse.json({ session: session ?? null });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju seje." },
      { status: 500 },
    );
  }
}