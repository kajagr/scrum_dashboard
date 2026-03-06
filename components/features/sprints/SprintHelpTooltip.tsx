"use client";

import { useEffect, useRef, useState } from "react";

const helpItems = [
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: "Creating a sprint",
    body: 'Click "+ New Sprint" to create a new sprint. Each sprint needs a name, a start date, an end date, and a velocity (story points).',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Velocity",
    body: "Velocity is the expected number of story points your team can complete in one sprint. Must be a positive whole number (max 100).",
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <circle cx="12" cy="12" r="9" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    title: "No overlapping sprints",
    body: "Sprints cannot overlap. If the dates of a new sprint conflict with an existing one, you'll need to adjust them.",
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Dates must be in the future",
    body: "The start date cannot be set in the past. The end date must always come after the start date.",
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
    title: "Sprint statuses",
    body: "Sprints are tagged as Planned, Active, or Completed based on their dates relative to today.",
  },
];

export default function SprintHelpTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Help"
        className={`w-6 h-6 rounded-full border text-xs font-bold transition-colors flex items-center justify-center
          ${open
            ? "bg-primary border-primary text-white"
            : "bg-surface border-border text-muted hover:border-primary hover:text-primary"
          }`}
      >
        ?
      </button>

      {open && (
        <div className="absolute left-0 top-8 z-50 w-80 rounded-2xl border border-border bg-surface shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-background">
            <p className="text-xs font-bold tracking-widest uppercase text-primary">How sprints work</p>
          </div>
          <div className="divide-y divide-border">
            {helpItems.map((item) => (
              <div key={item.title} className="flex gap-3 px-5 py-3.5">
                <span className="mt-0.5 flex-shrink-0 text-primary">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                  <p className="text-xs text-muted leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}