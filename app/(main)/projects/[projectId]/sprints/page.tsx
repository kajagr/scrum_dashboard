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
      if (!res.ok) { console.error("Error fetching sprints:", data.error); setSprints([]); return; }
      setSprints(data || []);
    } catch (error) {
      console.error("Error fetching sprints:", error);
      setSprints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadSprints(); }, [projectId]);

  const handleModalClose = async () => {
    setIsModalOpen(false);
    await loadSprints();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-subtle">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading sprints...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Project
          </p>
          <h1 className="text-3xl font-bold text-foreground leading-tight">Sprints</h1>
          <p className="text-sm text-muted mt-1">
            {sprints.length > 0
              ? `${sprints.length} sprint${sprints.length === 1 ? "" : "s"}`
              : "No sprints yet"}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
        >
          <span className="text-lg leading-none">+</span>
          New Sprint
        </button>
      </div>

      {/* Sprint list */}
      {sprints.length > 0 ? (
        <div className="space-y-3">
          {sprints.map((sprint) => (
            <SprintCard key={sprint.id} sprint={sprint} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 bg-surface border-border">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">No sprints yet</p>
          <p className="text-sm text-subtle">Create your first sprint</p>
        </div>
      )}

      <CreateSprintModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        existingSprints={sprints}
      />
    </div>
  );
}
