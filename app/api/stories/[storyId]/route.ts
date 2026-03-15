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

    // 1. preberi obstoječo zgodbo
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

    // 2. preveri role na projektu
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

    // 3. zgodba ne sme biti v sprintu
    if (story.sprint_id) {
      return NextResponse.json(
        { error: "Zgodbe, ki je dodeljena sprintu, ni mogoče urejati." },
        { status: 400 },
      );
    }

    // 4. zgodba ne sme biti realizirana
    if (story.status === "done") {
      return NextResponse.json(
        { error: "Realizirane zgodbe ni mogoče urejati." },
        { status: 400 },
      );
    }

    // 5. preberi body
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

    // 6. preveri podvajanje naslova v istem projektu
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

    // 7. update
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

    // 1. preberi zgodbo
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

    // 2. preveri role
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

    // 3. ne dovoli brisanja, če je v sprintu
    if (story.sprint_id) {
      return NextResponse.json(
        { error: "Zgodbe, ki je dodeljena sprintu, ni mogoče izbrisati." },
        { status: 400 },
      );
    }

    // 4. ne dovoli brisanja, če je realizirana
    if (story.status === "done") {
      return NextResponse.json(
        { error: "Realizirane zgodbe ni mogoče izbrisati." },
        { status: 400 },
      );
    }

    // 5. izbriši
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
