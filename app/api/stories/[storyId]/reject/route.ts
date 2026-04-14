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
 * /api/stories/{storyId}/reject:
 *   post:
 *     summary: Reject a user story
 *     description: >
 *       Product Owner rejects a user story, returning it to the backlog.
 *       The story must be in the active sprint and have status "ready" or "in_progress".
 *       On success, status is set to "backlog", sprint_id is cleared,
 *       and an optional rejection comment is saved both on the story and as a story comment.
 *     tags:
 *       - Stories
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story to reject
 *         example: "c3d4e5f6-a7b8-9012-cdef-345678901234"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *                 nullable: true
 *                 description: Optional rejection comment from the Product Owner
 *                 example: "Acceptance criteria not met."
 *     responses:
 *       200:
 *         description: Story rejected successfully and returned to backlog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Zgodba je bila zavrnjena in vrnjena v backlog."
 *                 story:
 *                   $ref: '#/components/schemas/UserStory'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     alreadyDone:
 *                       value: "Že potrjene zgodbe ni mogoče zavrniti."
 *                     alreadyBacklog:
 *                       value: "Zgodba je že v backlogu."
 *                     noSprint:
 *                       value: "Zgodba ni dodeljena nobenemu sprintu."
 *                     notActiveSprint:
 *                       value: "Zgodba ni v aktivnem sprintu."
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: User is not the Product Owner of this project
 *       404:
 *         description: Story not found
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { storyId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch story
  const { data: story } = await supabase
    .from("user_stories")
    .select("id, status, sprint_id, project_id")
    .eq("id", storyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!story)
    return NextResponse.json({ error: "Zgodba ne obstaja." }, { status: 404 });

  // Check caller is product_owner on this project
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", story.project_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "product_owner")
    return NextResponse.json(
      { error: "Samo Product Owner lahko zavrača zgodbe." },
      { status: 403 },
    );

  // Status validations
  if (story.status === "done")
    return NextResponse.json(
      { error: "Že potrjene zgodbe ni mogoče zavrniti." },
      { status: 400 },
    );

  if (story.status === "backlog")
    return NextResponse.json(
      { error: "Zgodba je že v backlogu." },
      { status: 400 },
    );

  // Optional comment from body
  let comment: string | null = null;
  try {
    const body = await req.json();
    comment = body.comment?.trim() || null;
  } catch {
    // no body is fine
  }

  // Reject — return to backlog
  const { data, error } = await supabaseAdmin
    .from("user_stories")
    .update({
      status: "backlog",
      sprint_id: null,
      rejected_at: new Date().toISOString(),
      rejection_comment: comment,
    })
    .eq("id", storyId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("POST /stories/[storyId]/reject error:", error);
    return NextResponse.json(
      { error: "Napaka pri zavračanju zgodbe." },
      { status: 500 },
    );
  }

  if (!data)
    return NextResponse.json(
      { error: "Napaka pri zavračanju zgodbe." },
      { status: 500 },
    );

  // Insert rejection comment into story_comments if provided
  if (comment) {
    await supabaseAdmin
      .from("story_comments")
      .insert({
        user_story_id: storyId,
        user_id: user.id,
        content: `❌ Rejected: ${comment}`,
      });
  }

  return NextResponse.json({
    message: "Zgodba je bila zavrnjena in vrnjena v backlog.",
    story: data,
  });
}