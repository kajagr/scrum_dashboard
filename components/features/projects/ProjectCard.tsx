"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import type { Project } from "@/lib/types";

type ProjectStatus = "active" | "on_hold" | "completed";

interface ProjectCardProps {
  project: Project;
  onStatusChange?: (id: string, status: ProjectStatus) => void;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string; dot: string; pill: string }[] = [
  {
    value: "active",
    label: "Active",
    dot: "bg-primary",
    pill: "bg-primary-light text-primary border-primary-border",
  },
  {
    value: "on_hold",
    label: "On Hold",
    dot: "bg-accent",
    pill: "bg-accent-light text-accent-text border-accent-border",
  },
  {
    value: "completed",
    label: "Completed",
    dot: "bg-subtle",
    pill: "bg-surface text-muted border-border",
  },
];

function getStatusCfg(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

export default function ProjectCard({ project, onStatusChange }: ProjectCardProps) {
  const rawStatus = (project.status ?? "active") as ProjectStatus;
  const [status, setStatus] = useState<ProjectStatus>(rawStatus);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (newStatus === status) { setDropdownOpen(false); return; }
    setSaving(true);
    setDropdownOpen(false);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onStatusChange?.(project.id, newStatus);
      }
    } finally {
      setSaving(false);
    }
  };

  const cfg = getStatusCfg(status);

  return (
    <div className="group relative rounded-2xl border border-border bg-surface transition-all duration-200 hover:border-primary hover:shadow-md hover:shadow-primary/10">
      {/* Left accent line */}
      <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full transition-opacity opacity-40 group-hover:opacity-100 ${cfg.dot}`} />

      <div className="pl-4 pr-4 pt-4 pb-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <Link
            href={`/projects/${project.id}`}
            className="text-base font-semibold text-foreground leading-snug hover:text-primary transition-colors flex-1 min-w-0 truncate"
          >
            {project.name}
          </Link>

          {/* Status badge — clickable */}
          <div ref={dropdownRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setDropdownOpen((o) => !o); }}
              disabled={saving}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all
                ${cfg.pill}
                ${saving ? "opacity-50 cursor-wait" : "hover:opacity-80 cursor-pointer"}`}
            >
              {saving ? (
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              )}
              {cfg.label}
              <svg className={`w-2.5 h-2.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl border border-border bg-surface shadow-lg shadow-black/30 overflow-hidden">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusChange(opt.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-left transition-colors hover:bg-background
                      ${status === opt.value ? "bg-background" : ""}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${opt.dot}`} />
                    <span className={status === opt.value ? "text-foreground font-semibold" : "text-muted"}>
                      {opt.label}
                    </span>
                    {status === opt.value && (
                      <svg className="ml-auto w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-4">
          {project.description || "Ni opisa."}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-subtle">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>
              Ustvarjen {new Date(project.created_at).toLocaleDateString("sl-SI", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          </div>
          <Link
            href={`/projects/${project.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-subtle hover:text-primary transition-colors"
          >
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
