import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    storyId: string;
  }>;
};

const ALLOWED_PRIORITIES = [
  "must_have",
  "should_have",
  "could_have",
  "wont_have",
] as const;

/**
 * @swagger
 * /api/stories/{storyId}:
 *   patch:
 *     summary: Update a user story
 *     description: >
 *       Updates an existing user story. Only Product Owners and Scrum Masters can edit stories.
 *       Stories assigned to a sprint or with status "done" cannot be edited.
 *       Story titles must remain unique within the project.
 *     tags:
 *       - Stories
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story to update
 *         example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - priority
 *               - business_value
 *             properties:
 *               title:
 *                 type: string
 *                 description: Must be unique within the project
 *                 example: "As a user, I want to log in"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "User should be able to log in with email and password."
 *               acceptance_criteria:
 *                 type: string
 *                 nullable: true
 *                 example: "Login form is visible. Error shown on wrong credentials."
 *               priority:
 *                 type: string
 *                 enum: [must_have, should_have, could_have, wont_have]
 *                 example: "must_have"
 *               business_value:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 10
 *               story_points:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 0
 *                 example: 3
 *     responses:
 *       200:
 *         description: User story updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStory'
 *       400:
 *         description: Validation failed or story cannot be edited
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     inSprint:
 *                       value: "Zgodbe, ki je dodeljena sprintu, ni mogoče urejati."
 *                     isDone:
 *                       value: "Realizirane zgodbe ni mogoče urejati."
 *                     missingFields:
 *                       value: "title, priority in business_value so obvezni."
 *                     invalidPriority:
 *                       value: "Neveljavna prioriteta."
 *                     invalidBusinessValue:
 *                       value: "business_value mora biti med 1 in 100."
 *                     invalidStoryPoints:
 *                       value: "story_points mora biti 0 ali več."
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
 *         description: User does not have permission to edit the story
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Nimaš pravic za urejanje zgodbe."
 *       404:
 *         description: User story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Zgodba ne obstaja."
 *       409:
 *         description: A user story with this title already exists in the project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User story s tem naslovom že obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri urejanju zgodbe."
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, title, status, sprint_id")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError) {
      return NextResponse.json({ error: storyError.message }, { status: 500 });
    }

    if (!story) {
      return NextResponse.json(
        { error: "Zgodba ne obstaja." },
        { status: 404 },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      );
    }

    if (
      !membership ||
      !["product_owner", "scrum_master"].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: "Nimaš pravic za urejanje zgodbe." },
        { status: 403 },
      );
    }

    if (story.sprint_id) {
      return NextResponse.json(
        { error: "Zgodbe, ki je dodeljena sprintu, ni mogoče urejati." },
        { status: 400 },
      );
    }

    if (story.status === "done") {
      return NextResponse.json(
        { error: "Realizirane zgodbe ni mogoče urejati." },
        { status: 400 },
      );
    }

    const body = await request.json();

    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const acceptanceCriteria = body.acceptance_criteria?.trim() || null;
    const priority = body.priority;
    const businessValue = body.business_value;
    const storyPoints =
      body.story_points === "" || body.story_points === undefined
        ? null
        : Number(body.story_points);

    if (
      !title ||
      !priority ||
      businessValue === undefined ||
      businessValue === null
    ) {
      return NextResponse.json(
        { error: "title, priority in business_value so obvezni." },
        { status: 400 },
      );
    }

    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: "Neveljavna prioriteta." },
        { status: 400 },
      );
    }

    const businessValueNumber = Number(businessValue);

    if (
      !Number.isFinite(businessValueNumber) ||
      businessValueNumber <= 0 ||
      businessValueNumber > 100
    ) {
      return NextResponse.json(
        { error: "business_value mora biti med 1 in 100." },
        { status: 400 },
      );
    }

    if (
      storyPoints !== null &&
      (!Number.isFinite(storyPoints) || storyPoints < 0)
    ) {
      return NextResponse.json(
        { error: "story_points mora biti 0 ali več." },
        { status: 400 },
      );
    }

    const { data: duplicateStory, error: duplicateError } = await supabase
      .from("user_stories")
      .select("id")
      .eq("project_id", story.project_id)
      .eq("title", title)
      .neq("id", storyId)
      .maybeSingle();

    if (duplicateError) {
      return NextResponse.json(
        { error: duplicateError.message },
        { status: 500 },
      );
    }

    if (duplicateStory) {
      return NextResponse.json(
        { error: "User story s tem naslovom že obstaja." },
        { status: 409 },
      );
    }

    const { data: updatedStory, error: updateError } = await supabase
      .from("user_stories")
      .update({
        title,
        description,
        acceptance_criteria: acceptanceCriteria,
        priority,
        business_value: businessValueNumber,
        story_points: storyPoints,
      })
      .eq("id", storyId)
      .select()
      .single();

    if (updateError) {
      if (
        updateError.message.toLowerCase().includes("row-level security") ||
        updateError.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za urejanje zgodbe." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedStory, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri urejanju zgodbe." },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/stories/{storyId}:
 *   delete:
 *     summary: Delete a user story
 *     description: >
 *       Deletes a user story. Only Product Owners and Scrum Masters can delete stories.
 *       Stories assigned to a sprint or with status "done" cannot be deleted.
 *     tags:
 *       - Stories
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user story to delete
 *         example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *     responses:
 *       200:
 *         description: User story deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Zgodba uspešno izbrisana."
 *       400:
 *         description: Story cannot be deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     inSprint:
 *                       value: "Zgodbe, ki je dodeljena sprintu, ni mogoče izbrisati."
 *                     isDone:
 *                       value: "Realizirane zgodbe ni mogoče izbrisati."
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
 *         description: User does not have permission to delete the story
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Nimaš pravic za brisanje zgodbe."
 *       404:
 *         description: User story not found
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
 *                   example: "Napaka pri brisanju zgodbe."
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, status, sprint_id")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError) {
      return NextResponse.json({ error: storyError.message }, { status: 500 });
    }

    if (!story) {
      return NextResponse.json(
        { error: "Zgodba ne obstaja." },
        { status: 404 },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      );
    }

    if (
      !membership ||
      !["product_owner", "scrum_master"].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: "Nimaš pravic za brisanje zgodbe." },
        { status: 403 },
      );
    }

    if (story.sprint_id) {
      return NextResponse.json(
        { error: "Zgodbe, ki je dodeljena sprintu, ni mogoče izbrisati." },
        { status: 400 },
      );
    }

    if (story.status === "done") {
      return NextResponse.json(
        { error: "Realizirane zgodbe ni mogoče izbrisati." },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from("user_stories")
      .delete()
      .eq("id", storyId)
      .select("id");

    if (deleteError) {
      if (
        deleteError.message.toLowerCase().includes("row-level security") ||
        deleteError.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za brisanje zgodbe." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Zgodba uspešno izbrisana." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Napaka pri brisanju zgodbe." },
      { status: 500 },
    );
  }
}