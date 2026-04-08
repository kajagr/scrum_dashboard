"use client";

import { useState, useEffect } from "react";
import type { Sprint } from "@/lib/types";

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

  useEffect(() => {
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? "");
      setStartDate(sprint.start_date);
      setEndDate(sprint.end_date);
      setVelocity(sprint.velocity?.toString() ?? "");
      setError(null);
    }
  }, [sprint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (velocity) {
      const v = Number(velocity);
      if (!Number.isFinite(v) || v <= 0) { setError("Hitrost mora biti pozitivno število."); return; }
      if (v > 100) { setError("Hitrost je previsoka (max 100)."); return; }
    }

    if (!isActive) {
      const today = new Date().toISOString().split("T")[0];
      if (startDate < today) { setError("Začetni datum ne sme biti v preteklosti."); return; }
      if (endDate <= startDate) { setError("Končni datum mora biti po začetnem datumu."); return; }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprint!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          // isActive
          //   ? { velocity: velocity ? Number(velocity) : null }
          //   : {
          //       name,
          //       goal: goal || null,
          //       start_date: startDate,
          //       end_date: endDate,
          //       velocity: velocity ? Number(velocity) : null,
          //     }
          { name, goal: goal || null, start_date: startDate, end_date: endDate, velocity: velocity ? Number(velocity) : null }
        ),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Napaka pri posodabljanju sprinta."); return; }
      onClose();
    } catch {
      setError("Napaka pri povezavi s strežnikom.");
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
                  Active — sprint cannot be edited
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
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>End date <span className="text-error normal-case font-normal tracking-normal">*</span></label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className={inputClass} />
                  </div>
                </div>
              </>
            )}

            {/* Velocity — always shown
            <div>
              <label className={labelClass}>Velocity <span className="text-subtle normal-case font-normal tracking-normal">(optional)</span></label>
              <input type="number" value={velocity} onChange={(e) => setVelocity(e.target.value)} min={1} max={100} className={inputClass} placeholder="e.g. 21" autoFocus={isActive} />
            </div> */}
            {/* Velocity — only for planned sprints */}
            {!isActive && (
              <div>
                <label className={labelClass}>Velocity <span className="text-subtle normal-case font-normal tracking-normal">(optional)</span></label>
                <input type="number" value={velocity} onChange={(e) => setVelocity(e.target.value)} min={1} max={100} className={inputClass} placeholder="e.g. 21" />
              </div>
            )}

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