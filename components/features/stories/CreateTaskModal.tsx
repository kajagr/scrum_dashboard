"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  storyId,
  projectId,
}: CreateTaskModalProps) {
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number | "">("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!isOpen) return;

      setLoadingMembers(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/members`, {
          credentials: "include",
        });

        if (res.ok) {
          const data: ProjectMember[] = await res.json();
          const assignable = data.filter(
            (m) => m.role === "developer" || m.role === "scrum_master"
          );
          setMembers(assignable);
        }
      } catch {
        console.error("Error loading project members.");
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [isOpen, projectId]);

  const resetForm = () => {
    setDescription("");
    setEstimatedHours("");
    setAssigneeId("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!description.trim()) {
      setError("Task description is required.");
      setLoading(false);
      return;
    }

    if (estimatedHours === "" || Number(estimatedHours) <= 0) {
      setError("Estimated time must be greater than 0.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/stories/${storyId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          description,
          estimated_hours: estimatedHours,
          assignee_id: assigneeId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create task.");
        setLoading(false);
        return;
      }

      resetForm();
      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError("A server error occurred.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      <div
        className="relative m-4 w-full max-w-lg rounded-2xl p-6 shadow-xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
        }}
      >
        <h2 className="mb-4 text-xl font-bold text-[var(--color-foreground)]">
          New Task
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">
              Task Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Describe the task..."
              className="mt-1 block w-full rounded-md px-3 py-2 text-sm outline-none transition"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">
              Estimated Time (hours) *
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={estimatedHours}
              onChange={(e) =>
                setEstimatedHours(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              placeholder="e.g. 4"
              className="mt-1 block w-full rounded-md px-3 py-2 text-sm outline-none transition"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">
              Suggested Team Member (optional)
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 block w-full rounded-md px-3 py-2 text-sm outline-none transition"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            >
              <option value="">-- Unassigned --</option>
              {loadingMembers ? (
                <option disabled>Loading...</option>
              ) : (
                members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user?.first_name} {member.user?.last_name} ({member.user?.email})
                  </option>
                ))
              )}
            </select>

            <p className="mt-1 text-xs text-[var(--color-muted)]">
              The team member must accept the task before it becomes assigned.
            </p>
          </div>

          {error && (
            <div
              className="rounded-md p-3"
              style={{
                background: "var(--color-error-light)",
                border: "1px solid var(--color-error-border)",
              }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--color-error)" }}
              >
                {error}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-4 py-2 font-medium transition hover:opacity-90"
              style={{
                background: "var(--color-background)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-md px-4 py-2 font-medium text-white transition disabled:opacity-50 hover:opacity-90"
              style={{
                background: "var(--color-primary)",
                border: "1px solid var(--color-primary-border)",
              }}
            >
              {loading ? "Saving..." : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}