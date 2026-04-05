import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
 *       Updates an existing user story. Supports an optional `action` field.
 *
 *       **Actions:**
 *       - `mark_ready` — Scrum Master or Developer marks a story as ready for Product Owner review.
 *         Story must be in an active sprint and have status "in_progress".
 *       - `unmark_ready` — Scrum Master reverts a ready story back to in_progress.
 *         Story must have status "ready".
 *       - *(no action)* — Full story edit. Only Product Owners and Scrum Masters can edit stories.
 *         Stories assigned to a sprint or with status "done" cannot be edited.
 *         Story titles must remain unique within the project.
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
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [mark_ready, unmark_ready]
 *                 nullable: true
 *                 description: >
 *                   Optional action to perform instead of a full edit.
 *                   `mark_ready` marks story as ready for review.
 *                   `unmark_ready` reverts a ready story back to in_progress.
 *                 example: "mark_ready"
 *               title:
 *                 type: string
 *                 description: Must be unique within the project (edit only)
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
 *                 maximum: 10
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
 *                       value: "Stories assigned to a sprint cannot be edited."
 *                     isDone:
 *                       value: "Completed stories cannot be edited."
 *                     notInProgress:
 *                       value: "Only in-progress stories can be marked as ready."
 *                     notReady:
 *                       value: "Story is not marked as ready."
 *                     notInSprint:
 *                       value: "Story is not assigned to any sprint."
 *                     notActiveSprint:
 *                       value: "Story is not in an active sprint."
 *                     missingFields:
 *                       value: "Title, priority and business value are required."
 *                     invalidPriority:
 *                       value: "Invalid priority value."
 *                     invalidBusinessValue:
 *                       value: "Business value must be between 1 and 10."
 *                     invalidStoryPoints:
 *                       value: "Story points must be 0 or greater."
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: User does not have permission
 *       404:
 *         description: User story not found
 *       409:
 *         description: A user story with this title already exists in the project
 *       500:
 *         description: Internal server error
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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // story_points dodano v select
    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, title, status, sprint_id, story_points")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError) {
      return NextResponse.json({ error: storyError.message }, { status: 500 });
    }
    if (!story) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
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
    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to edit this story." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { action } = body;

    // --- action: mark_ready ---
    if (action === "mark_ready") {
      if (
        membership.role !== "scrum_master" &&
        membership.role !== "developer"
      ) {
        return NextResponse.json(
          {
            error:
              "Only Scrum Masters and developers can mark stories as ready.",
          },
          { status: 403 },
        );
      }

      if (story.status !== "in_progress") {
        return NextResponse.json(
          { error: "Only in-progress stories can be marked as ready." },
          { status: 400 },
        );
      }

      if (!story.sprint_id) {
        return NextResponse.json(
          { error: "Story is not assigned to any sprint." },
          { status: 400 },
        );
      }

      const { data: sprint } = await supabase
        .from("sprints")
        .select("start_date, end_date")
        .eq("id", story.sprint_id)
        .maybeSingle();

      if (!sprint) {
        return NextResponse.json(
          { error: "Story is not assigned to any sprint." },
          { status: 400 },
        );
      }

      const today = new Date().toISOString().split("T")[0];
      const isActive = sprint.start_date <= today && sprint.end_date >= today;
      if (!isActive) {
        return NextResponse.json(
          { error: "Story is not in an active sprint." },
          { status: 400 },
        );
      }

      const { data: updatedStory, error: updateError } = await supabaseAdmin
        .from("user_stories")
        .update({ status: "ready", updated_at: new Date().toISOString() })
        .eq("id", storyId)
        .select()
        .maybeSingle();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json(updatedStory, { status: 200 });
    }

    // --- action: unmark_ready ---
    if (action === "unmark_ready") {
      if (membership.role !== "scrum_master") {
        return NextResponse.json(
          { error: "Only Scrum Masters can undo ready status." },
          { status: 403 },
        );
      }

      if (story.status !== "ready") {
        return NextResponse.json(
          { error: "Story is not marked as ready." },
          { status: 400 },
        );
      }

      const { data: updatedStory, error: updateError } = await supabaseAdmin
        .from("user_stories")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", storyId)
        .select()
        .maybeSingle();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json(updatedStory, { status: 200 });
    }

    // --- no action: full edit ---
    if (!["product_owner", "scrum_master"].includes(membership.role)) {
      return NextResponse.json(
        { error: "You don't have permission to edit this story." },
        { status: 403 },
      );
    }

    if (story.sprint_id) {
      const { data: sprint } = await supabase
        .from("sprints")
        .select("start_date, end_date")
        .eq("id", story.sprint_id)
        .maybeSingle();

      const today = new Date().toISOString().split("T")[0];
      const isActive =
        sprint && today >= sprint.start_date && today <= sprint.end_date;

      if (isActive) {
        return NextResponse.json(
          { error: "Stories assigned to a sprint cannot be edited." },
          { status: 400 },
        );
      }
    }
    if (story.status === "done") {
      return NextResponse.json(
        { error: "Completed stories cannot be edited." },
        { status: 400 },
      );
    }

    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const acceptanceCriteria = body.acceptance_criteria?.trim() || null;
    const priority = body.priority;
    const businessValue = body.business_value;

    // PO ne more nastaviti story_points dokler jih SM ni prvič določil
    const storyPoints =
      membership.role === "product_owner" && story.story_points === null
        ? null
        : body.story_points === "" || body.story_points === undefined
          ? null
          : Number(body.story_points);

    if (
      !title ||
      !priority ||
      businessValue === undefined ||
      businessValue === null
    ) {
      return NextResponse.json(
        { error: "Title, priority and business value are required." },
        { status: 400 },
      );
    }
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority value." },
        { status: 400 },
      );
    }

    const businessValueNumber = Number(businessValue);
    if (
      !Number.isFinite(businessValueNumber) ||
      businessValueNumber <= 0 ||
      businessValueNumber > 10
    ) {
      return NextResponse.json(
        { error: "Business value must be between 1 and 10." },
        { status: 400 },
      );
    }
    if (
      storyPoints !== null &&
      (!Number.isFinite(storyPoints) || storyPoints < 0)
    ) {
      return NextResponse.json(
        { error: "Story points must be 0 or greater." },
        { status: 400 },
      );
    }

    const { data: duplicateStory, error: duplicateError } = await supabase
      .from("user_stories")
      .select("id")
      .eq("project_id", story.project_id)
      .ilike("title", title)
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
        { error: "A story with this title already exists in the project." },
        { status: 409 },
      );
    }

    const { data: updatedStory, error: updateError } = await supabaseAdmin
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
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updatedStory) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }

    return NextResponse.json(updatedStory, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "An error occurred while updating the story." },
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
 *       Soft deletes a user story by ID (sets deleted_at timestamp).
 *       Only Product Owners and Scrum Masters can delete stories.
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
 *                   example: "Story deleted successfully."
 *       400:
 *         description: Story cannot be deleted
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: User does not have permission to delete the story
 *       404:
 *         description: User story not found
 *       500:
 *         description: Internal server error
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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
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
        { error: "You don't have permission to delete this story." },
        { status: 403 },
      );
    }

    if (story.sprint_id) {
      const { data: sprint } = await supabase
        .from("sprints")
        .select("start_date, end_date")
        .eq("id", story.sprint_id)
        .maybeSingle();

      const today = new Date().toISOString().split("T")[0];
      const isActive =
        sprint && today >= sprint.start_date && today <= sprint.end_date;

      if (isActive) {
        return NextResponse.json(
          { error: "Stories assigned to a sprint cannot be deleted." },
          { status: 400 },
        );
      }
    }
    if (story.status === "done") {
      return NextResponse.json(
        { error: "Completed stories cannot be deleted." },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("user_stories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", storyId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Story deleted successfully." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "An error occurred while deleting the story." },
      { status: 500 },
    );
  }
}
