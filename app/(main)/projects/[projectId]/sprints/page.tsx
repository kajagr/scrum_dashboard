"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CreateSprintModal from "@/components/features/sprints/CreateSprintModal";
import EditSprintModal from "@/components/features/sprints/EditSprintModal";
import SprintCard from "@/components/features/sprints/SprintCard";
import SprintHelpTooltip from "@/components/features/sprints/SprintHelpTooltip";
import type { Sprint } from "@/lib/types";

export default function SprintsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectRole, setProjectRole] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editSprint, setEditSprint] = useState<Sprint | null>(null);
  const [deleteSprint, setDeleteSprint] = useState<Sprint | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadSprints = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setSprints([]); return; }
      setSprints(data || []);
    } catch {
      setSprints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSprints();
    fetch(`/api/projects/${projectId}/members/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.role) setProjectRole(d.role); })
      .catch(() => {});
  }, [projectId]);

  const handleDeleteConfirm = async () => {
    if (!deleteSprint) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${deleteSprint.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error || "Napaka pri brisanju."); return; }
      setDeleteSprint(null);
      await loadSprints();
    } catch {
      setDeleteError("Napaka pri povezavi s strežnikom.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const isScrumMaster = projectRole === "scrum_master";

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
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">Sprints</h1>
            <SprintHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {sprints.length > 0
              ? `${sprints.length} sprint${sprints.length === 1 ? "" : "s"}`
              : "No sprints yet"}
          </p>
        </div>

        {isScrumMaster && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
          >
            <span className="text-lg leading-none">+</span>
            New Sprint
          </button>
        )}
      </div>

      {/* Sprint list */}
      {sprints.length > 0 ? (
        <div className="space-y-3">
          {sprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              canEdit={isScrumMaster}
              onEdit={(s) => setEditSprint(s)}
              onDelete={(s) => { setDeleteError(null); setDeleteSprint(s); }}
            />
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
          <p className="text-sm text-subtle">
            {isScrumMaster ? "Create your first sprint to get started." : "No sprints have been created yet."}
          </p>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={() => !deleteLoading && setDeleteSprint(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
            <div className="h-1 w-full bg-gradient-to-r from-error to-error-border" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-error-light border border-error-border flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Delete sprint</h3>
                  <p className="text-sm text-muted">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-sm text-foreground mb-5">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteSprint.name}</span>?
              </p>

              {deleteError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-error-border bg-error-light mb-4">
                  <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-sm text-error">{deleteError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteSprint(null)}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-error hover:bg-error/90"
                >
                  {deleteLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Deleting...
                    </span>
                  ) : "Delete sprint"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateSprintModal
        isOpen={isCreateOpen}
        onClose={async () => { setIsCreateOpen(false); await loadSprints(); }}
        projectId={projectId}
        existingSprints={sprints}
      />
      <EditSprintModal
        isOpen={!!editSprint}
        onClose={async () => { setEditSprint(null); await loadSprints(); }}
        sprint={editSprint}
        projectId={projectId}
        existingSprints={sprints}
      />
    </div>
  );
}