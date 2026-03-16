"use client";

import { useState } from "react";
import type { Priority } from "@/lib/types";

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const PRIORITIES: { value: Priority; label: string; desc: string; color: string }[] = [
  { value: "must_have",   label: "Must Have",   desc: "Crucial for success",      color: "text-error border-error-border bg-error-light" },
  { value: "should_have", label: "Should Have", desc: "Important, not critical",  color: "text-accent-text border-accent-border bg-accent-light" },
  { value: "could_have",  label: "Could Have",  desc: "Nice to have, not crucial", color: "text-primary border-primary-border bg-primary-light" },
  { value: "wont_have",   label: "Won't Have",  desc: "For the future",            color: "text-muted border-border bg-surface" },
];

const priorityDot: Record<Priority, string> = {
  must_have:   "bg-error",
  should_have: "bg-accent",
  could_have:  "bg-primary",
  wont_have:   "bg-subtle",
};

interface FieldError {
  title?: string;
  businessValue?: string;
  priority?: string;
  duplicate?: string;
}

export default function CreateStoryModal({ isOpen, onClose, projectId }: CreateStoryModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [priority, setPriority] = useState<Priority>("should_have");
  const [businessValue, setBusinessValue] = useState<number | "">("");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: FieldError = {};
    if (!title.trim()) {
      errors.title = "Title is required.";
    } else if (title.trim().length < 3) {
      errors.title = "Title must have at least 3 characters.";
    } else if (title.trim().length > 200) {
      errors.title = "Title is too long (max 200 characters).";
    }
    if (businessValue === "") {
      errors.businessValue = "Business value is required.";
    } else if (!Number.isInteger(Number(businessValue)) || Number(businessValue) < 1 || Number(businessValue) > 100) {
      errors.businessValue = "Business value must be an integer between 1 and 100.";
    }
    if (!["must_have", "should_have", "could_have", "wont_have"].includes(priority)) {
      errors.priority = "Invalid priority.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleClose = () => {
    setTitle(""); setDescription(""); setAcceptanceCriteria("");
    setPriority("should_have"); setBusinessValue("");
    setFieldErrors({}); setServerError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          acceptance_criteria: acceptanceCriteria.trim() || null,
          priority,
          story_points: 3,
          business_value: businessValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setFieldErrors({ duplicate: `A story with the title "${title.trim()}" already exists in this project.` });
        } else if (res.status === 403) {
          setServerError("You do not have permission to add user stories. Only the Product Owner and Scrum Master can add stories.");
        } else if (res.status === 400) {
          setServerError(data.error || "Validation error.");
        } else {
          setServerError(data.error || "Error while creating story.");
        }
        setLoading(false);
        return;
      }
      handleClose();
    } catch {
      setServerError("A server error occurred.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (hasError: boolean) =>
    `mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 bg-background border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
      hasError ? "border-error-border focus:ring-error/20 focus:border-error" : "border-border"
    }`;

  const labelClass = "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/30" onClick={handleClose} />

      <div className="relative w-full max-w-xl mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface max-h-[92vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent flex-shrink-0" />

        <div className="p-7 flex flex-col overflow-hidden flex-1">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">Backlog</p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">New user story</h2>
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted">×</button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1">

            {/* Title */}
            <div>
              <label className={labelClass}>
                Title <span className="text-error normal-case font-normal tracking-normal">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFieldErrors((f) => ({ ...f, title: undefined, duplicate: undefined })); }}
                autoFocus
                placeholder="As a user I want to..."
                maxLength={200}
                className={inputClass(!!fieldErrors.title || !!fieldErrors.duplicate)}
              />
              <div className="flex justify-between mt-1">
                {fieldErrors.title ? (
                  <p className="text-xs text-error">{fieldErrors.title}</p>
                ) : fieldErrors.duplicate ? (
                  <p className="text-xs text-error">{fieldErrors.duplicate}</p>
                ) : <span />}
                <p className="text-xs text-subtle ml-auto">{title.length}/200</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Detailed story description..."
                className={inputClass(false) + " resize-none"}
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
                className={inputClass(false) + " resize-none font-mono text-xs"}
              />
            </div>

            {/* Priority */}
            <div>
              <label className={labelClass}>
                Priority <span className="text-error normal-case font-normal tracking-normal">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setPriority(p.value); setFieldErrors((f) => ({ ...f, priority: undefined })); }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      priority === p.value
                        ? p.color + " ring-1 ring-current"
                        : "border-border bg-background text-muted hover:border-primary hover:text-foreground"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priority === p.value ? priorityDot[p.value] : "bg-subtle"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight">{p.label}</p>
                      <p className="text-[10px] opacity-70 leading-tight truncate">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              {fieldErrors.priority && <p className="text-xs text-error mt-1">{fieldErrors.priority}</p>}
            </div>

            {/* Business Value */}
            <div>
              <label className={labelClass}>
                Business Value <span className="text-error normal-case font-normal tracking-normal">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={businessValue}
                onChange={(e) => { setBusinessValue(e.target.value === "" ? "" : Number(e.target.value)); setFieldErrors((f) => ({ ...f, businessValue: undefined })); }}
                placeholder="1 – 100"
                className={inputClass(!!fieldErrors.businessValue)}
              />
              {fieldErrors.businessValue && <p className="text-xs text-error mt-1">{fieldErrors.businessValue}</p>}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light flex-shrink-0">
                <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-error">{serverError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-border pt-4 flex justify-end gap-3 flex-shrink-0">
              <button type="button" onClick={handleClose} className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Creating...
                  </span>
                ) : "Create story →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}