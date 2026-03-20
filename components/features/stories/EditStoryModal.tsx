"use client";

import { useState } from "react";
import type { UserStory } from "@/lib/types";

interface EditStoryModalProps {
  story: UserStory;
  onClose: () => void;
  onSaved: () => void;
}

const PRIORITIES = [
  {
    value: "must_have",
    label: "Must Have",
    desc: "Crucial for success",
    color: "text-error border-error-border bg-error-light",
  },
  {
    value: "should_have",
    label: "Should Have",
    desc: "Important, not critical",
    color: "text-accent-text border-accent-border bg-accent-light",
  },
  {
    value: "could_have",
    label: "Could Have",
    desc: "Nice to have, not crucial",
    color: "text-primary border-primary-border bg-primary-light",
  },
  {
    value: "wont_have",
    label: "Won't Have",
    desc: "For the future",
    color: "text-muted border-border bg-surface",
  },
] as const;

const priorityDot: Record<string, string> = {
  must_have: "bg-error",
  should_have: "bg-accent",
  could_have: "bg-primary",
  wont_have: "bg-subtle",
};

export default function EditStoryModal({
  story,
  onClose,
  onSaved,
}: EditStoryModalProps) {
  const [title, setTitle] = useState(story.title ?? "");
  const [description, setDescription] = useState(story.description ?? "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    story.acceptance_criteria ?? "",
  );
  const [priority, setPriority] = useState<
    "must_have" | "should_have" | "could_have" | "wont_have"
  >(
    (story.priority as
      | "must_have"
      | "should_have"
      | "could_have"
      | "wont_have") ?? "should_have",
  );
  const [storyPoints, setStoryPoints] = useState<number | "">(
    story.story_points ?? "",
  );
  const [businessValue, setBusinessValue] = useState<number | "">(
    story.business_value ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          acceptance_criteria: acceptanceCriteria,
          priority,
          story_points: storyPoints === "" ? null : storyPoints,
          business_value: businessValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "An error occurred while updating the story.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Server connection error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "An error occurred while deleting the story.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Server connection error.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 " +
    "bg-background border border-border text-foreground " +
    "placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  const labelClass =
    "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm bg-foreground/30"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface max-h-[92vh] flex flex-col">
        {/* Gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent flex-shrink-0" />

        <div className="p-7 flex flex-col overflow-hidden flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
                Backlog
              </p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                Edit story
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1">
            {/* Title */}
            <div>
              <label className={labelClass}>
                Title{" "}
                <span className="text-error normal-case font-normal tracking-normal">
                  *
                </span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-subtle text-right">
                {title.length}/200
              </p>
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Detailed story description..."
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Acceptance criteria */}
            <div>
              <label className={labelClass}>Acceptance Criteria</label>
              <textarea
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                rows={3}
                placeholder={"- Criterion 1\n- Criterion 2\n- Criterion 3"}
                className={inputClass + " resize-none font-mono text-xs"}
              />
            </div>

            {/* Priority */}
            <div>
              <label className={labelClass}>
                Priority{" "}
                <span className="text-error normal-case font-normal tracking-normal">
                  *
                </span>
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      priority === p.value
                        ? p.color + " ring-1 ring-current"
                        : "border-border bg-background text-muted hover:border-primary hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${priority === p.value ? priorityDot[p.value] : "bg-subtle"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight">
                        {p.label}
                      </p>
                      <p className="text-[10px] opacity-70 leading-tight truncate">
                        {p.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Story points + Business value */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Story Points</label>
                <input
                  type="number"
                  min="0"
                  value={storyPoints}
                  onChange={(e) =>
                    setStoryPoints(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="e.g. 5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Business Value{" "}
                  <span className="text-error normal-case font-normal tracking-normal">
                    *
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={businessValue}
                  onChange={(e) =>
                    setBusinessValue(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="1 – 10"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light flex-shrink-0">
                <svg
                  className="w-4 h-4 text-error mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-border pt-4 flex justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-error text-white hover:opacity-90"
              >
                Delete story
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover"
                >
                  {saving ? (
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
                      Saving...
                    </span>
                  ) : (
                    "Save changes →"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
