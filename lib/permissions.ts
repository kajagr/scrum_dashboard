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
    .single();
  
  return !!data;
}

// Preveri ali lahko user upravlja člane projekta (owner ali admin)
export async function canManageProjectMembers(userId: string, projectId: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Admin lahko vedno
  if (await isAdmin(userId)) {
    return true;
  }
  
  // Owner projekta lahko
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();
  
  return project?.owner_id === userId;
}