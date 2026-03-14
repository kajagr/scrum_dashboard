"use client";

import { useState, useEffect, useRef } from "react";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  projectId: string;
}

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  user: { id: string; first_name: string; last_name: string; email: string } | null;
}

function AssigneeDropdown({ members, loadingMembers, assigneeId, setAssigneeId }: {
  members: ProjectMember[];
  loadingMembers: boolean;
  assigneeId: string;
  setAssigneeId: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = members.find((m) => m.user_id === assigneeId);
  const initials = (m: ProjectMember) =>
    `${m.user?.first_name?.[0] ?? ""}${m.user?.last_name?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div ref={ref} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border transition-all bg-background text-left
          ${open ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-subtle"}`}
      >
        {selected ? (
          <>
            <span className="w-7 h-7 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {initials(selected)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {selected.user?.first_name} {selected.user?.last_name}
              </p>
              <p className="text-xs text-muted truncate">{selected.user?.email}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAssigneeId(""); }}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-border text-muted hover:text-foreground transition-colors flex-shrink-0"
            >
              ×
            </button>
          </>
        ) : (
          <>
            <span className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <span className="text-subtle flex-1">No assignment</span>
            <svg className={`w-4 h-4 text-muted transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[200] rounded-xl border border-border bg-surface shadow-xl shadow-black/20 overflow-y-auto max-h-56">
          {/* No assignment option */}
          <button
            type="button"
            onClick={() => { setAssigneeId(""); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-background
              ${assigneeId === "" ? "bg-primary-light" : ""}`}
          >
            <span className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <span className="text-sm text-muted">No assignment</span>
            {assigneeId === "" && (
              <svg className="w-4 h-4 text-primary ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Divider */}
          {members.length > 0 && <div className="h-px bg-border mx-3" />}

          {/* Members */}
          {loadingMembers ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading members...
            </div>
          ) : (
            members.map((member) => (
              <button
                key={member.user_id}
                type="button"
                onClick={() => { setAssigneeId(member.user_id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-background
                  ${assigneeId === member.user_id ? "bg-primary-light" : ""}`}
              >
                <span className="w-7 h-7 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {initials(member)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {member.user?.first_name} {member.user?.last_name}
                  </p>
                  <p className="text-xs text-muted truncate">{member.user?.email}</p>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0
                  ${member.role === "scrum_master"
                    ? "bg-accent-light text-accent-text border border-accent-border"
                    : "bg-background text-muted border border-border"}`}>
                  {member.role === "scrum_master" ? "SM" : "Dev"}
                </span>
                {assigneeId === member.user_id && (
                  <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CreateTaskModal({ isOpen, onClose, storyId, projectId }: CreateTaskModalProps) {
  const [description, setDescription] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number | "">("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingMembers(true);
    fetch(`/api/projects/${projectId}/members`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: ProjectMember[]) => {
        setMembers(data.filter((m) => m.role === "developer" || m.role === "scrum_master"));
      })
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, [isOpen, projectId]);

  const resetForm = () => { setDescription(""); setEstimatedHours(""); setAssigneeId(""); setError(null); };
  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError("Task description is required."); return; }
    if (estimatedHours === "" || Number(estimatedHours) <= 0) { setError("Estimated hours must be greater than 0."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description,
          estimated_hours: estimatedHours,
          assignee_id: assigneeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error creating task."); return; }
      resetForm();
      onClose();
    } catch {
      setError("A server error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all bg-background border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  const labelClass = "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={handleClose} />

      <div className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl bg-surface">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent rounded-t-2xl" />

        <div className="p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">Story</p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">New task</h2>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Description */}
            <div>
              <label className={labelClass}>
                Description <span className="text-error normal-case font-normal tracking-normal">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(null); }}
                rows={3}
                placeholder="Describe the task..."
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Estimated hours */}
            <div>
              <label className={labelClass}>
                Estimated hours <span className="text-error normal-case font-normal tracking-normal">*</span>
              </label>
              <input
                type="number" min="0.5" step="0.5"
                value={estimatedHours}
                onChange={(e) => { setEstimatedHours(e.target.value === "" ? "" : Number(e.target.value)); setError(null); }}
                placeholder="e.g. 4"
                className={inputClass}
              />
            </div>

            {/* Assignee — custom dropdown */}
            <div className="relative">
              <label className={labelClass}>Suggested assignee <span className="normal-case font-normal tracking-normal text-muted">(optional)</span></label>
              <AssigneeDropdown
                members={members}
                loadingMembers={loadingMembers}
                assigneeId={assigneeId}
                setAssigneeId={setAssigneeId}
              />
              <p className="mt-1.5 text-xs text-muted">
                The member must accept the task before it is officially assigned.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
                <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-border pt-4 flex justify-end gap-3">
              <button
                type="button" onClick={handleClose}
                className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </span>
                ) : "Add task →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}