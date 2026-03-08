"use client";

import { useEffect, useMemo, useState } from "react";
import CreateProjectModal from "@/components/features/projects/CreateProjectModal";
import ProjectCard from "@/components/features/projects/ProjectCard";
import type { Project } from "@/lib/types";

type FilterStatus = "All" | "Active" | "On Hold" | "Completed";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("All");

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Napaka pri nalaganju projektov");
      }

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(err instanceof Error ? err.message : "Neznana napaka");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleModalClose = () => {
    setIsModalOpen(false);
    fetchProjects();
  };

  const filteredProjects = useMemo(() => {
    if (activeFilter === "All") return projects;

    return projects.filter((project) => {
      const status = (project as any).status?.toLowerCase();

      if (activeFilter === "Active") return status === "active";
      if (activeFilter === "On Hold") return status === "on hold";
      if (activeFilter === "Completed") return status === "completed";

      return true;
    });
  }, [projects, activeFilter]);

  if (loading) {
    return (
      <div className="px-6 py-8 md:px-8">
        <p className="text-sm text-gray-500">Nalaganje...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 md:px-8">
        <p className="text-sm text-red-500">Napaka: {error}</p>
      </div>
    );
  }

  const filters: FilterStatus[] = ["All", "Active", "On Hold", "Completed"];

  return (
    <div className="px-6 py-8 md:px-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            Projects
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track all your projects
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0B0F1A] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          <span className="text-base leading-none">+</span>
          <span>Create Project</span>
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filters.map((filter) => {
          const isActive = activeFilter === filter;

          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-[#0B0F1A] bg-[#0B0F1A] text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-base font-medium text-gray-700">
            Ni še projektov.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Ustvari prvi projekt za začetek.
          </p>
        </div>
      )}

      <CreateProjectModal isOpen={isModalOpen} onClose={handleModalClose} />
    </div>
  );
}