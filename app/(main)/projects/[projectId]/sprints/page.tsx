"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CreateSprintModal from "@/components/features/sprints/CreateSprintModal";
import SprintCard from "@/components/features/sprints/SprintCard";
import type { Sprint } from "@/lib/types";

export default function SprintsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadSprints = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Error fetching sprints:", data.error);
        setSprints([]);
        return;
      }

      setSprints(data || []);
    } catch (error) {
      console.error("Error fetching sprints:", error);
      setSprints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSprints();
  }, [projectId]);

  const handleModalClose = async () => {
    setIsModalOpen(false);
    await loadSprints();
  };

  if (loading) {
    return (
      <div>
        <p className="text-gray-500">Nalaganje...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>
          <p className="text-gray-600">Plan and manage your sprints</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Create Sprint
        </button>
      </div>

      <div className="space-y-4">
        {sprints.length > 0 ? (
          sprints.map((sprint) => (
            <SprintCard key={sprint.id} sprint={sprint} />
          ))
        ) : (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            <p>Ni še sprintov.</p>
            <p className="text-sm">Ustvari prvi sprint za začetek.</p>
          </div>
        )}
      </div>

      <CreateSprintModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
      />
    </div>
  );
}
