import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Preveri ali je user admin
  const { data: userData } = await supabase
    .from("users")
    .select("system_role")
    .eq("id", user.id)
    .single();

  if (userData?.system_role === "admin") {
    return <>{children}</>;
  }

  // Preveri aktivno membership (removed_at IS NULL)
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!membership) redirect("/projects");

  return <>{children}</>;
}
