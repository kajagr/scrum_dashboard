import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDashboardPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();

  // Fetch project details
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Fetch stats (example queries - adjust based on your needs)
  const { count: storiesCount } = await supabase
    .from("user_stories")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { count: sprintsCount } = await supabase
    .from("sprints")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="text-gray-600">{project.description || "No description"}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">User Stories</div>
          <div className="text-2xl font-bold">{storiesCount || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Sprints</div>
          <div className="text-2xl font-bold">{sprintsCount || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Team Members</div>
          <div className="text-2xl font-bold">-</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Progress</div>
          <div className="text-2xl font-bold">-</div>
        </div>
      </div>

      <p className="text-gray-500 text-sm">
        To je dashboard projekta. Tukaj lahko dodaš več statistik in grafov.
      </p>
    </div>
  );
}