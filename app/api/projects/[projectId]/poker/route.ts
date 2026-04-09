import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Nisi član projekta." }, { status: 403 });
    }

    const { data: sessions } = await supabase
      .from("poker_sessions")
      .select("id, user_story_id, status, current_round")
      .eq("project_id", projectId)
      .eq("status", "active");

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju sej." },
      { status: 500 },
    );
  }
}
