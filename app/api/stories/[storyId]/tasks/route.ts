import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    storyId: string;
  }>;
};

// GET /api/stories/[storyId]/tasks - Fetch tasks for a story
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:users(id, first_name, last_name, email)
      `)
      .eq("user_story_id", storyId)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju nalog." },
      { status: 500 }
    );
  }
}

// POST /api/stories/[storyId]/tasks - Create a new task
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { storyId } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: story, error: storyError } = await supabase
      .from("user_stories")
      .select("id, project_id, sprint_id, status")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError) {
      return NextResponse.json({ error: storyError.message }, { status: 500 });
    }

    if (!story) {
      return NextResponse.json(
        { error: "Uporabniška zgodba ne obstaja." },
        { status: 404 }
      );
    }

    if (story.status === "done") {
      return NextResponse.json(
        { error: "Naloge ni mogoče dodati k že realizirani zgodbi." },
        { status: 400 }
      );
    }

    if (!story.sprint_id) {
      return NextResponse.json(
        { error: "Naloge je mogoče dodati samo zgodbam v aktivnem sprintu." },
        { status: 400 }
      );
    }

    const { data: sprint, error: sprintError } = await supabase
      .from("sprints")
      .select("id, status, start_date, end_date")
      .eq("id", story.sprint_id)
      .maybeSingle();

    if (sprintError || !sprint) {
      return NextResponse.json(
        { error: "Sprint ne obstaja." },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const sprintStatus =
      today < sprint.start_date ? "planned" :
      today > sprint.end_date ? "completed" : "active";

    if (sprintStatus !== "active") {
      return NextResponse.json(
        { error: "Naloge je mogoče dodati samo zgodbam v aktivnem sprintu." },
        { status: 400 }
      );
    }

    const { data: membership, error: memberError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", story.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json(
        { error: "Nisi član tega projekta." },
        { status: 403 }
      );
    }

    if (membership.role !== "scrum_master" && membership.role !== "developer") {
      return NextResponse.json(
        { error: "Samo skrbnik metodologije in razvijalci lahko dodajajo naloge." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const description = body.description?.trim();
    const estimatedHours = body.estimated_hours;
    const assigneeId = body.assignee_id || null;

    if (!description) {
      return NextResponse.json(
        { error: "Opis naloge je obvezen." },
        { status: 400 }
      );
    }

    if (estimatedHours === undefined || estimatedHours === null || estimatedHours === "") {
      return NextResponse.json(
        { error: "Ocena časa je obvezna." },
        { status: 400 }
      );
    }

    const hours = Number(estimatedHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json(
        { error: "Ocena časa mora biti pozitivna številka." },
        { status: 400 }
      );
    }

    if (assigneeId) {
      const { data: assigneeMembership, error: assigneeError } = await supabase
        .from("project_members")
        .select("id, role")
        .eq("project_id", story.project_id)
        .eq("user_id", assigneeId)
        .maybeSingle();

      if (assigneeError) {
        return NextResponse.json({ error: assigneeError.message }, { status: 500 });
      }

      if (!assigneeMembership) {
        return NextResponse.json(
          { error: "Izbrani član ni del tega projekta." },
          { status: 400 }
        );
      }

      if (assigneeMembership.role !== "developer" && assigneeMembership.role !== "scrum_master") {
        return NextResponse.json(
          { error: "Naloge lahko prevzamejo samo razvijalci in skrbniki metodologije." },
          { status: 400 }
        );
      }
    }

    const { data: tasks } = await supabase
      .from("tasks")
      .select("position")
      .eq("user_story_id", storyId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = tasks && tasks.length > 0 ? tasks[0].position + 1 : 0;

    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        user_story_id: storyId,
        title: description,
        description: description,
        estimated_hours: hours,
        assignee_id: assigneeId,
        status: "unassigned",
        position: nextPosition,
      })
      .select(`
        *,
        assignee:users(id, first_name, last_name, email)
      `)
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri ustvarjanju naloge." },
      { status: 500 }
    );
  }
}