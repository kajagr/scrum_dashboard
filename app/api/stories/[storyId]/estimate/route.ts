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

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, sprint_id, status")
      .eq("id", storyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (storyError) {
      return NextResponse.json({ error: storyError.message }, { status: 500 });
    }
    if (!story) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }

    // Samo scrum master
    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (membership?.role !== "scrum_master") {
      return NextResponse.json(
        { error: "Only Scrum Masters can estimate stories." },
        { status: 403 },
      );
    }

    // Zgodba ne sme biti v sprintu
    if (story.sprint_id) {
      return NextResponse.json(
        { error: "Stories assigned to a sprint cannot be estimated." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const storyPoints = Number(body.story_points);

    if (!Number.isFinite(storyPoints) || storyPoints <= 0) {
      return NextResponse.json(
        { error: "Story points must be a positive number." },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("user_stories")
      .update({ story_points: storyPoints })
      .eq("id", storyId)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "An error occurred while setting the estimate." },
      { status: 500 },
    );
  }
}
