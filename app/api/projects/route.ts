import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canCreateProject, projectNameExists } from "@/lib/permissions";

// GET /api/projects - Fetch all projects for current user
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/projects - Create a new project (ADMIN ONLY)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const canCreate = await canCreateProject(user.id);
  if (!canCreate) {
    return NextResponse.json(
      { error: "Only an administrator can create a project" }, 
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, description, members } = body;

  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  // Check for duplicate project name
  const nameExists = await projectNameExists(name);
  if (nameExists) {
    return NextResponse.json(
      { error: "A project with this name already exists" }, 
      { status: 400 }
    );
  }

  // Create project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      owner_id: user.id,
    })
    .select()
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  // Add members if provided
  if (members && Array.isArray(members) && members.length > 0) {
    const memberInserts = members.map((member: { user_id: string; role: string }) => ({
      project_id: project.id,
      user_id: member.user_id,
      role: member.role,
    }));

    const { error: membersError } = await supabase
      .from("project_members")
      .insert(memberInserts);

    if (membersError) {
      console.error("Error adding members:", membersError);
    }
  }

  // Add creator as a member (product_owner)
  await supabase.from("project_members").insert({
    project_id: project.id,
    user_id: user.id,
    role: "product_owner",
  });

  return NextResponse.json(project, { status: 201 });
}