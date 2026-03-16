"use client";

import { useEffect, useRef, useState } from "react";

const helpItems = [
  {
    icon: (
      <svg
        className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5V4H2v16h5m10 0v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5m10 0H7"
        />
      </svg>
    ),
    title: "What is the Team page?",
    desc: "The Team page shows all members of the project and their current Scrum roles.",
  },
  {
    icon: (
      <svg
        className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
    title: "Project members",
    desc: "Each row shows a project member with their name, email address, and assigned role.",
  },
  {
    icon: (
      <svg
        className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4v16m8-8H4"
        />
      </svg>
    ),
    title: "Adding members",
    desc: "Use the Add member button to invite or add people to the project team.",
  },
  {
    icon: (
      <svg
        className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7h18M3 12h12M3 17h6"
        />
      </svg>
    ),
    title: "Scrum roles",
    desc: "The system uses Product Owner, Scrum Master, and Developer roles to organize team responsibilities.",
  },
  {
    icon: (
      <svg
        className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="9" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8h.01M11 12h1v4h1"
        />
      </svg>
    ),
    title: "Member count",
    desc: "The number under the page title shows how many members are currently part of the project.",
  },
];

export default function TeamHelpTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Team help"
        className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-colors
          ${
            open
              ? "bg-primary border-primary-border text-white"
              : "bg-surface border-border text-muted hover:border-primary hover:text-primary"
          }`}
      >
        ?
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-80 rounded-2xl border border-border bg-surface shadow-xl shadow-black/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary">
              Help
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              Team management
            </p>
          </div>

          <div className="p-3 space-y-1">
            {helpItems.map((item, i) => (
              <div
                key={i}
                className="flex gap-3 px-3 py-2.5 rounded-xl hover:bg-background transition-colors"
              >
                {item.icon}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-0.5">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}