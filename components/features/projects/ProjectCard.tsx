import Link from "next/link";
import type { Project } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative block rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10"
    >
      {/* Left accent line */}
      <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="pl-1">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          <span className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-primary-light text-primary border-primary-border">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Active
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-4">
          {project.description || "No description provided."}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-subtle">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Created {new Date(project.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
          <svg className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
