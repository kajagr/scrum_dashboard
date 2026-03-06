"use client";

import { useEffect, useState } from "react";
import CreateProjectModal from "@/components/features/projects/CreateProjectModal";
import ProjectCard from "@/components/features/projects/ProjectCard";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    fetchProjects(); // Refresh projects after creating
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Nalaganje...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-500">Napaka: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage and track all your projects</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          + Create Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length > 0 ? (
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p>Ni še projektov.</p>
            <p className="text-sm">Ustvari prvi projekt za začetek.</p>
          </div>
        )}
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}