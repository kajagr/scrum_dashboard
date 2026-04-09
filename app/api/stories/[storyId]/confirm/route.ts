import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

/**
 * @swagger
 * /api/stories/{storyId}/confirm:
 *   post:
 *     summary: Confirm a user story
 *     description: >
 *       Product Owner confirms a user story that is ready for review.
 *       The story must be in the active sprint and have status "ready".
 *       On success, status is set to "done".
 *     tags:
 *       - Stories
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story to confirm
 *         example: "c3d4e5f6-a7b8-9012-cdef-345678901234"
 *     responses:
 *       200:
 *         description: Story confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Zgodba je bila uspešno potrjena."
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
 *                       value: "Zgodba je že potrjena."
 *                     alreadyRejected:
 *                       value: "Zavrnjene zgodbe ni mogoče potrditi."
 *                     notReady:
 *                       value: "Zgodba še ni pripravljena za potrditev (status mora biti 'ready')."
 *                     noSprint:
 *                       value: "Zgodba ni dodeljena nobenemu sprintu."
 *                     notActiveSprint:
 *                       value: "Zgodba ni v aktivnem sprintu."
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
 *         description: User is not the Product Owner of this project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Samo Product Owner lahko potrjuje zgodbe."
 *       404:
 *         description: Story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Zgodba ne obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri potrjevanju zgodbe."
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
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
      { error: "Samo Product Owner lahko potrjuje zgodbe." },
      { status: 403 },
    );

  // Status validations
  if (story.status === "done")
    return NextResponse.json(
      { error: "Zgodba je že potrjena." },
      { status: 400 },
    );

  if (story.status === "backlog" && !story.sprint_id)
    return NextResponse.json(
      { error: "Zgodba ni dodeljena nobenemu sprintu." },
      { status: 400 },
    );

  if (story.status !== "ready")
    return NextResponse.json(
      { error: "Zgodba še ni pripravljena za potrditev (status mora biti 'ready')." },
      { status: 400 },
    );

  // Check sprint is active
  if (!story.sprint_id)
    return NextResponse.json(
      { error: "Zgodba ni dodeljena nobenemu sprintu." },
      { status: 400 },
    );

  const { data: sprint } = await supabase
    .from("sprints")
    .select("start_date, end_date")
    .eq("id", story.sprint_id)
    .maybeSingle();

  if (!sprint)
    return NextResponse.json(
      { error: "Sprint zgodbe ne obstaja." },
      { status: 400 },
    );

  const today = new Date().toISOString().split("T")[0];
  const isActiveOrExpired = sprint.start_date <= today;

  if (!isActiveOrExpired)
    return NextResponse.json(
      { error: "Zgodba ni v aktivnem sprintu." },
      { status: 400 },
    );

  // Confirm
  const { data, error } = await supabase
    .from("user_stories")
    .update({
      status: "done",
      realized_at: new Date().toISOString(),
    })
    .eq("id", storyId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("POST /stories/[storyId]/confirm error:", error);
    return NextResponse.json(
      { error: "Napaka pri potrjevanju zgodbe." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Zgodba je bila uspešno potrjena.", story: data });
}