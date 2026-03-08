import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageProjectMembers } from "@/lib/permissions";
import type { ProjectRole } from "@/lib/types";

const VALID_ROLES: ProjectRole[] = ["product_owner", "scrum_master", "developer"];

interface MemberInput {
  user_id: string;
  role: ProjectRole;
}

// GET /api/projects/[id]/members - Fetch all members of a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Preveri ali projekt obstaja
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Projekt ne obstaja." }, { status: 404 });
    }

    // Fetch members with user details
    const { data: members, error } = await supabase
      .from("project_members")
      .select(`
        *,
        user:users(id, email, username, first_name, last_name)
      `)
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(members);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju članov." },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/members - Add members to project (bulk)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Preveri ali lahko uporabnik upravlja člane
    const canManage = await canManageProjectMembers(user.id, projectId);
    if (!canManage) {
      return NextResponse.json(
        { error: "Nimaš pravic za upravljanje članov tega projekta." },
        { status: 403 }
      );
    }

    // Preveri ali projekt obstaja
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Projekt ne obstaja." }, { status: 404 });
    }

    const body = await request.json();
    const { members } = body as { members: MemberInput[] };

    // Validacija: members array obstaja in ni prazen
    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "Seznam članov je obvezen." },
        { status: 400 }
      );
    }

    // Validacija: preveri duplikate v requestu
    const userIds = members.map((m) => m.user_id);
    const uniqueUserIds = new Set(userIds);
    if (uniqueUserIds.size !== userIds.length) {
      return NextResponse.json(
        { error: "Seznam vsebuje podvojene uporabnike." },
        { status: 400 }
      );
    }

    // Validacija: vse vloge so veljavne
    for (const member of members) {
      if (!VALID_ROLES.includes(member.role)) {
        return NextResponse.json(
          { error: `Neveljavna vloga: ${member.role}. Veljavne vloge so: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validacija: vsi uporabniki obstajajo
    const { data: existingUsers } = await supabase
      .from("users")
      .select("id")
      .in("id", userIds);

    const existingUserIds = new Set(existingUsers?.map((u) => u.id) || []);
    const missingUsers = userIds.filter((id) => !existingUserIds.has(id));

    if (missingUsers.length > 0) {
      return NextResponse.json(
        { error: `Naslednji uporabniki ne obstajajo: ${missingUsers.join(", ")}` },
        { status: 400 }
      );
    }

    // Validacija: uporabniki še niso člani projekta
    const { data: existingMembers } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .in("user_id", userIds);

    const alreadyMembers = existingMembers?.map((m) => m.user_id) || [];
    if (alreadyMembers.length > 0) {
      // Pridobi usernames za boljše sporočilo
      const { data: alreadyMemberUsers } = await supabase
        .from("users")
        .select("username")
        .in("id", alreadyMembers);

      const usernames = alreadyMemberUsers?.map((u) => u.username).join(", ");
      return NextResponse.json(
        { error: `Naslednji uporabniki so že člani projekta: ${usernames}` },
        { status: 400 }
      );
    }

    // Pripravi podatke za insert
    const memberInserts = members.map((member) => ({
      project_id: projectId,
      user_id: member.user_id,
      role: member.role,
    }));

    // Insert vseh članov (atomic operacija - Supabase insert je transactional)
    const { data: insertedMembers, error: insertError } = await supabase
      .from("project_members")
      .insert(memberInserts)
      .select(`
        *,
        user:users(id, email, username, first_name, last_name)
      `);

    if (insertError) {
      return NextResponse.json(
        { error: "Napaka pri dodajanju članov: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: `Uspešno dodanih ${insertedMembers.length} članov.`,
        members: insertedMembers,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error adding members:", err);
    return NextResponse.json(
      { error: "Napaka pri obdelavi zahteve." },
      { status: 500 }
    );
  }
}