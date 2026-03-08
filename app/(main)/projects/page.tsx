"use client";

import { useEffect, useMemo, useState } from "react";
import CreateProjectModal from "@/components/features/projects/CreateProjectModal";
import ProjectCard from "@/components/features/projects/ProjectCard";
import ProjectHelpTooltip from "@/components/features/projects/ProjectHelpTooltip";
import type { Project } from "@/lib/types";

type FilterStatus = "All" | "Active" | "On Hold" | "Completed";
const filters: FilterStatus[] = ["All", "Active", "On Hold", "Completed"];

const filterToStatus: Record<FilterStatus, string> = {
  "All": "",
  "Active": "active",
  "On Hold": "on_hold",
  "Completed": "completed",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("All");

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load projects.");
      }
      setProjects(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleModalClose = () => { setIsModalOpen(false); fetchProjects(); };

  const handleStatusChange = (id: string, status: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: status as Project["status"] }
          : p
      )
    );
  };

  const filteredProjects = useMemo(() => {
    const target = filterToStatus[activeFilter];
    if (!target) return projects;
    return projects.filter((p) => p.status === target);
  }, [projects, activeFilter]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-subtle">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
          <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Workspace
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">Projects</h1>
            <ProjectHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {projects.length > 0
              ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
              : "No projects yet"}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
        >
          <span className="text-lg leading-none">+</span>
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              activeFilter === f
                ? "bg-primary-light text-primary border-primary-border"
                : "bg-surface text-muted border-border hover:border-primary hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">No projects yet</p>
          <p className="text-sm text-subtle">
            {activeFilter !== "All"
              ? `No projects with status "${activeFilter}".`
              : "Create your first project to get started."}
          </p>
        </div>
      )}

      <CreateProjectModal isOpen={isModalOpen} onClose={handleModalClose} />
    </div>
  );
}
