import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

function getSprintStatus(startDate: string, endDate: string) {
  const today = new Date().toISOString().split("T")[0];

  if (today < startDate) return "planned";
  if (today > endDate) return "completed";
  return "active";
}

// GET /api/projects/:projectId/sprints
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("sprints")
      .select("*")
      .eq("project_id", projectId)
      .order("start_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sprintsWithUpdatedStatus = (data ?? []).map((sprint) => ({
      ...sprint,
      status: getSprintStatus(sprint.start_date, sprint.end_date),
    }));

    return NextResponse.json(sprintsWithUpdatedStatus, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju sprintov." },
      { status: 500 },
    );
  }
}

// POST /api/projects/:projectId/sprints
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { projectId } = await context.params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, goal, start_date, end_date, velocity } = body;

    if (!name || !start_date || !end_date) {
      return NextResponse.json(
        { error: "name, start_date in end_date so obvezni." },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().split("T")[0];

    if (start_date < today) {
      return NextResponse.json(
        { error: "Začetni datum ne sme biti v preteklosti." },
        { status: 400 },
      );
    }

    if (end_date <= start_date) {
      return NextResponse.json(
        { error: "Končni datum mora biti po začetnem." },
        { status: 400 },
      );
    }

    if (velocity !== undefined && velocity !== null && velocity !== "") {
      const velocityNumber = Number(velocity);

      if (!Number.isFinite(velocityNumber) || velocityNumber <= 0) {
        return NextResponse.json(
          { error: "Velocity mora biti pozitivna številka." },
          { status: 400 },
        );
      }

      if (velocityNumber > 100) {
        return NextResponse.json(
          { error: "Velocity je previsok." },
          { status: 400 },
        );
      }
    }

    // preverjanje prekrivanja sprintov
    const { data: overlappingSprints, error: overlapError } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", projectId)
      .lte("start_date", end_date)
      .gte("end_date", start_date);

    if (overlapError) {
      return NextResponse.json(
        { error: overlapError.message },
        { status: 500 },
      );
    }

    if (overlappingSprints && overlappingSprints.length > 0) {
      return NextResponse.json(
        { error: "Sprint se prekriva z obstoječim sprintom." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("sprints")
      .insert({
        project_id: projectId,
        name,
        goal,
        start_date,
        end_date,
        velocity: velocity ?? null,
        status: "planned",
      })
      .select()
      .single();

    if (error) {
      // RLS / pravice
      if (
        error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("permission denied")
      ) {
        return NextResponse.json(
          { error: "Nimaš pravic za ustvarjanje sprinta." },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri ustvarjanju sprinta." },
      { status: 500 },
    );
  }
}
