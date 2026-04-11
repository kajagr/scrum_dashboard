"use client";

import { useState, useEffect, useRef } from "react";
import type { Sprint } from "@/lib/types";
import { formatDateDot } from "@/lib/datetime";

interface EditSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  sprint: Sprint | null;
  projectId: string;
  existingSprints: Sprint[];
}

export default function EditSprintModal({
  isOpen,
  onClose,
  sprint,
  projectId,
}: EditSprintModalProps) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [velocity, setVelocity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isActive = sprint?.status === "active";
  const startPickerRef = useRef<HTMLInputElement>(null);
  const endPickerRef = useRef<HTMLInputElement>(null);

  const [minVelocity, setMinVelocity] = useState<number>(0);

  useEffect(() => {
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? "");
      setStartDate(sprint.start_date);
      setEndDate(sprint.end_date);
      setVelocity(sprint.velocity?.toString() ?? "");
      setError(null);
      setMinVelocity(0);

      // Fetch assigned story points for active sprint
      const today = new Date().toISOString().split("T")[0];
      const isAct = sprint.start_date <= today && sprint.end_date >= today;
      if (isAct) {
        fetch(`/api/projects/${projectId}/backlog`, { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            const total = (data.assigned ?? [])
              .filter((s: any) => !s.unfinished_sprint_info)
              .reduce((sum: number, s: any) => sum + (s.story_points ?? 0), 0);
            setMinVelocity(total);
          })
          .catch(() => {});
      }
    }
  }, [sprint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (velocity) {
      const v = Number(velocity);
      if (!Number.isFinite(v) || v <= 0) {
        setError("Velocity must be a positive number.");
        return;
      }
      if (!Number.isInteger(v)) {
        setError("Velocity must be a whole number (story points).");
        return;
      }
      if (v > 100) {
        setError("Velocity is too high (maximum 100).");
        return;
      }
    }

    if (!isActive) {
      const today = new Date().toISOString().split("T")[0];
      if (startDate < today) {
        setError("Start date cannot be in the past.");
        return;
      }
      if (endDate <= startDate) {
        setError("End date must be after the start date.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprint!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          isActive
            ? { velocity: velocity ? Number(velocity) : null }
            : {
                name,
                goal: goal || null,
                start_date: startDate,
                end_date: endDate,
                velocity: velocity ? Number(velocity) : null,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update sprint.");
        return;
      }
      onClose();
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !sprint) return null;

  const inputClass = "mt-1 block w-full px-3 py-2.5 rounded-lg text-sm bg-background border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
  const labelClass = "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />
        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">Sprint</p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">Edit sprint</h2>
              {isActive && (
                <p className="text-xs text-muted mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                  Active — only velocity can be edited
                </p>
              )}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full fields — planned only */}
            {!isActive && (
              <>
                <div>
                  <label className={labelClass}>Name <span className="text-error normal-case font-normal tracking-normal">*</span></label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} placeholder="Sprint 1" />
                </div>

                <div>
                  <label className={labelClass}>Goal</label>
                  <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass} placeholder="Optional sprint goal" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Start date <span className="text-error normal-case font-normal tracking-normal">*</span></label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        readOnly
                        value={startDate ? formatDateDot(startDate) : ""}
                        placeholder="DD.MM.YYYY"
                        onClick={() => startPickerRef.current?.showPicker()}
                        className={`${inputClass} cursor-pointer pr-10`}
                      />
                      <input
                        ref={startPickerRef}
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        tabIndex={-1}
                        required
                      />
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>End date <span className="text-error normal-case font-normal tracking-normal">*</span></label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        readOnly
                        value={endDate ? formatDateDot(endDate) : ""}
                        placeholder="DD.MM.YYYY"
                        onClick={() => endPickerRef.current?.showPicker()}
                        className={`${inputClass} cursor-pointer pr-10`}
                      />
                      <input
                        ref={endPickerRef}
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        tabIndex={-1}
                        required
                      />
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Velocity — always shown
            <div>
              <label className={labelClass}>Velocity <span className="text-subtle normal-case font-normal tracking-normal">(optional)</span></label>
              <input type="number" value={velocity} onChange={(e) => setVelocity(e.target.value)} min={1} max={100} className={inputClass} placeholder="e.g. 21" autoFocus={isActive} />
            </div> */}
            {/* Velocity — planned + active (active is velocity-only) */}
            <div>
              <label className={labelClass}>
                Velocity{" "}
                <span className="text-subtle normal-case font-normal tracking-normal">
                  (optional)
                </span>
              </label>
              <input
                type="number"
                value={velocity}
                onChange={(e) => setVelocity(e.target.value)}
                min={1}
                max={100}
                step={1}
                className={inputClass}
                placeholder="e.g. 21"
                autoFocus={isActive}
              />
              {isActive && minVelocity > 0 && (
                <p className="mt-1 text-xs text-subtle">
                  Minimum velocity: {minVelocity} pts (total story points in sprint)
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
                <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="border-t border-border pt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted">Cancel</button>
              <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </span>
                ) : "Save changes →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}