import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export default async function ProjectsPage() {
  const supabase = await createClient();
  
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage and track all your projects</p>
        </div>
        <Link
          href="/projects/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          + Create Project
        </Link>
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects && projects.length > 0 ? (
          projects.map((project: Project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {project.name}
                </h3>
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                  Active
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                {project.description || "No description"}
              </p>
              <div className="text-xs text-gray-400">
                Created {new Date(project.created_at).toLocaleDateString("sl-SI")}
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p>Ni še projektov.</p>
            <p className="text-sm">Ustvari prvi projekt za začetek.</p>
          </div>
        )}
      </div>
    </div>
  );
}