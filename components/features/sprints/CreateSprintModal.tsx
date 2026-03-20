"use client";

import { useState, useRef } from "react";
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

// ── Slovenian public holidays (fixed dates) ───────────────────────────────────
const SLOVENIAN_HOLIDAYS = new Set([
  "01-01",
  "01-02", // New Year
  "02-08", // Prešeren Day
  "04-27", // Day of Uprising Against Occupation
  "05-01",
  "05-02", // Labour Day
  "06-25", // Statehood Day
  "08-15", // Assumption of Mary
  "10-31", // Reformation Day
  "11-01", // All Saints' Day
  "12-25", // Christmas
  "12-26", // Independence and Unity Day
]);

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

function isHoliday(dateStr: string): boolean {
  const mmdd = dateStr.slice(5); // "MM-DD"
  return SLOVENIAN_HOLIDAYS.has(mmdd);
}

// Convert DD.MM.YYYY → YYYY-MM-DD for API/validation
function toIso(dateStr: string): string {
  if (!dateStr || dateStr.length !== 10) return "";
  const [d, m, y] = dateStr.split(".");
  if (!d || !m || !y) return "";
  return `${y}-${m}-${d}`;
}

// Auto-insert dots as user types: "20" → "20.", "2003" → "20.03.", etc.
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
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

  const startPickerRef = useRef<HTMLInputElement>(null);
  const endPickerRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setName("");
    setGoal("");
    setStartDate("");
    setEndDate("");
    setVelocity("");
    setError(null);
    onClose();
  };

  const today = new Date().toISOString().split("T")[0];

  // startDate and endDate are stored as YYYY-MM-DD from the hidden date input
  const startIso = startDate; // already ISO
  const endIso = endDate; // already ISO

  const validate = (): string | null => {
    if (!startDate) return "Start date is required.";
    if (!endDate) return "End date is required.";
    if (startIso < today) return "Start date cannot be in the past.";
    if (endIso <= startIso) return "End date must be after the start date.";

    if (isWeekend(startIso))
      return `Start date (${startDate}) cannot be on a weekend.`;
    if (isHoliday(startIso))
      return `Start date (${startDate}) is a Slovenian public holiday.`;
    if (isWeekend(endIso))
      return `End date (${endDate}) cannot be on a weekend.`;
    if (isHoliday(endIso))
      return `End date (${endDate}) is a Slovenian public holiday.`;

    if (velocity === "") return "Velocity is required.";
    const v = Number(velocity);
    if (!Number.isFinite(v) || v <= 0)
      return "Velocity must be a positive number (greater than 0).";
    if (!Number.isInteger(v))
      return "Velocity must be an integer (story points).";
    if (v > 100) return "Velocity is too high (maximum 100 story points).";

    const overlap = existingSprints.find(
      (s) => startIso < s.end_date && endIso > s.start_date,
    );
    if (overlap) {
      const os =
        toIso(overlap.start_date) === overlap.start_date
          ? `${overlap.start_date.slice(8)}.${overlap.start_date.slice(5, 7)}.${overlap.start_date.slice(0, 4)}`
          : overlap.start_date;
      const oe =
        toIso(overlap.end_date) === overlap.end_date
          ? `${overlap.end_date.slice(8)}.${overlap.end_date.slice(5, 7)}.${overlap.end_date.slice(0, 4)}`
          : overlap.end_date;
      return `The sprint overlaps with the existing sprint "${overlap.name}" (${os} – ${oe}).`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          goal,
          start_date: startIso,
          end_date: endIso,
          velocity: Number(velocity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error while creating sprint.");
        setLoading(false);
        return;
      }
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      setVelocity("");
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

  const labelClass =
    "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm bg-foreground/40"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

        <div className="p-7">
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
              onClick={handleClose}
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
                id="name"
                type="text"
                value={name}
                required
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="example: Sprint 1"
                className={inputClass}
              />
            </div>

            {/* Goal */}
            <div>
              <label htmlFor="goal" className={labelClass}>
                Sprint Goal
              </label>
              <textarea
                id="goal"
                rows={2}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do we want to achieve in this sprint?"
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  Start Date <span className="text-accent">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    readOnly
                    value={
                      startDate
                        ? `${startDate.slice(8)}.${startDate.slice(5, 7)}.${startDate.slice(0, 4)}`
                        : ""
                    }
                    placeholder="DD.MM.YYYY"
                    onClick={() => startPickerRef.current?.showPicker()}
                    className="block w-full px-3 py-2.5 rounded-lg text-sm bg-surface border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer pr-10"
                  />
                  <input
                    ref={startPickerRef}
                    type="date"
                    value={startDate}
                    min={today}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    tabIndex={-1}
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
                <label className={labelClass}>
                  End Date <span className="text-accent">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    readOnly
                    value={
                      endDate
                        ? `${endDate.slice(8)}.${endDate.slice(5, 7)}.${endDate.slice(0, 4)}`
                        : ""
                    }
                    placeholder="DD.MM.YYYY"
                    onClick={() => endPickerRef.current?.showPicker()}
                    className="block w-full px-3 py-2.5 rounded-lg text-sm bg-surface border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer pr-10"
                  />
                  <input
                    ref={endPickerRef}
                    type="date"
                    value={endDate}
                    min={startDate || today}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    tabIndex={-1}
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
            <p className="text-xs text-subtle -mt-3">
              Start and end dates cannot fall on weekends or holidays.
            </p>

            {/* Velocity */}
            <div>
              <label htmlFor="velocity" className={labelClass}>
                Sprint Velocity <span className="text-accent">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  id="velocity"
                  type="number"
                  value={velocity}
                  min={1}
                  max={100}
                  step={1}
                  required
                  onChange={(e) => setVelocity(e.target.value)}
                  placeholder="example: 40"
                  className="block w-full px-3 py-2.5 pr-28 rounded-lg text-sm transition-all duration-150 bg-surface border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted border-l border-border pl-3">
                  story points
                </span>
              </div>
              <p className="mt-1 text-xs text-subtle">
                Maximum 100 story points.
              </p>
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
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Create Sprint →"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
