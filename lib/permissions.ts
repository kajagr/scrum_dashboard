import { createClient } from "@/lib/supabase/server";

// Preveri ali je user admin
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("system_role")
    .eq("id", userId)
    .single();
  return data?.system_role === "admin";
}

// Preveri ali lahko user ustvari projekt (samo admin)
export async function canCreateProject(userId: string): Promise<boolean> {
  return await isAdmin(userId);
}

// Preveri ali projekt z istim imenom že obstaja
export async function projectNameExists(name: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  return !!data;
}

// Preveri ali lahko user upravlja člane projekta (owner ali admin)
export async function canManageProjectMembers(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const supabase = await createClient();
  if (await isAdmin(userId)) return true;
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();
  return project?.owner_id === userId;
}

// Centralna funkcija za membership check — vedno filtriraj removed_at
// Vrne { role } če je aktiven član, null če ni (ali je bil odstranjen)
export async function getProjectMembership(
  userId: string,
  projectId: string,
): Promise<{ role: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();
  return data ?? null;
}
