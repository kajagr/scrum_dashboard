import Link from "next/link";
import type { Project } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
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
  );
}