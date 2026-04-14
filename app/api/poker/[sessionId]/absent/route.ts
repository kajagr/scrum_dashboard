import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: session } = await supabase
      .from("poker_sessions")
      .select("id, project_id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Seja ne obstaja." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", session.project_id)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!membership || membership.role !== "scrum_master") {
      return NextResponse.json(
        { error: "Samo skrbnik metodologije lahko ureja odsotne člane." },
        { status: 403 },
      );
    }

    if (session.status !== "active") {
      return NextResponse.json({ error: "Seja ni aktivna." }, { status: 400 });
    }

    const body = await request.json();
    const { absent_member_ids } = body;

    if (!Array.isArray(absent_member_ids)) {
      return NextResponse.json(
        { error: "absent_member_ids mora biti seznam." },
        { status: 400 },
      );
    }

    if (absent_member_ids.length > 0) {
      const { data: validMembers } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", session.project_id)
        .in("role", ["scrum_master", "developer"])
        .is("removed_at", null);

      const validIds = new Set(validMembers?.map((m) => m.user_id) ?? []);
      for (const id of absent_member_ids) {
        if (!validIds.has(id)) {
          return NextResponse.json(
            { error: "Neveljaven član." },
            { status: 400 },
          );
        }
      }
    }

    const { error } = await supabaseAdmin
      .from("poker_sessions")
      .update({ absent_member_ids })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ absent_member_ids }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Napaka pri posodabljanju odsotnih članov." },
      { status: 500 },
    );
  }
}
