"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ExistingSprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingSprints?: ExistingSprint[];
}

export default function CreateSprintModal({
  isOpen,
  onClose,
  projectId,
  existingSprints = [],
}: CreateSprintModalProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [velocity, setVelocity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const validate = (): string | null => {
    if (startDate < today) return "Start date cannot be in the past.";
    if (endDate <= startDate) return "End date must be after the start date.";
    if (velocity === "") return "Velocity is required.";
    const v = Number(velocity);
    if (!Number.isFinite(v) || v <= 0) return "Velocity must be a positive number (greater than 0).";
    if (!Number.isInteger(v)) return "Velocity must be an integer (story points).";
    if (v > 100) return "Velocity is too high (maximum 100).";
    const overlap = existingSprints.find(
      (s) => startDate < s.end_date && endDate > s.start_date
    );
    if (overlap) {
      return `The sprint overlaps with the existing sprint "${overlap.name}" (${overlap.start_date} – ${overlap.end_date}).`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name, goal,
          start_date: startDate,
          end_date: endDate,
          velocity: Number(velocity),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error while creating sprint."); setLoading(false); return; }
      setName(""); setGoal(""); setStartDate(""); setEndDate(""); setVelocity("");
      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError("An error occurred on the server.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    "mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 " +
    "bg-surface border border-border text-foreground " +
    "placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  const labelClass = "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/40" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

        <div className="p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
                New Sprint
              </p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                Create Sprint
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className={labelClass}>
                Sprint Name <span className="text-accent">*</span>
              </label>
              <input
                id="name" type="text" value={name} required autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="example: Sprint 1"
                className={inputClass}
              />
            </div>

            {/* Goal */}
            <div>
              <label htmlFor="goal" className={labelClass}>Sprint Goal</label>
              <textarea
                id="goal" rows={2} value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do we want to achieve in this sprint?"
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="startDate" className={labelClass}>
                  Start Date <span className="text-accent">*</span>
                </label>
                <input
                  id="startDate" type="date" value={startDate} min={today} required
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="endDate" className={labelClass}>
                  End Date <span className="text-accent">*</span>
                </label>
                <input
                  id="endDate" type="date" value={endDate} min={startDate || today} required
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Velocity */}
            <div>
              <label htmlFor="velocity" className={labelClass}>
                Sprint Velocity <span className="text-accent">*</span>
              </label>
              <input
                id="velocity" type="number" value={velocity} min={1} max={100} step={1} required
                onChange={(e) => setVelocity(e.target.value)}
                placeholder="example: 40"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-subtle">Maximum 100 story points.</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
                <span className="text-base mt-0.5 text-error">⚠</span>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="border-t border-border pt-2" />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button" onClick={onClose}
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
                    Creating...
                  </span>
                ) : "Create Sprint →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
