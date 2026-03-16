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
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    title: "What is the Sprint Board?",
    desc: "The Sprint Board shows all stories assigned to the active sprint and the tasks inside each story.",
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
          d="M9 5l7 7-7 7"
        />
      </svg>
    ),
    title: "Expand a story",
    desc: "Click a story row to expand it and view all tasks grouped by their current state.",
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
        <path strokeLinecap="round" d="M12 7v5l3 3" />
      </svg>
    ),
    title: "Progress tracking",
    desc: "The progress bar shows how many sprint tasks are completed. Story and task completion counts are also shown in the sprint summary.",
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
    title: "Task groups",
    desc: "Tasks are grouped as Active, Assigned, Unassigned, and Done so the team can quickly see what is being worked on and what still needs attention.",
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
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
    title: "Assignees",
    desc: "A task may be unassigned or suggested to a developer or Scrum Master. Assigned users are shown directly on the task card.",
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
          d="M11 5h2m-1 0v14m7-7H5"
        />
      </svg>
    ),
    title: "Adding and editing tasks",
    desc: "Developers and Scrum Masters can add tasks to stories. Unaccepted and incomplete tasks can also be edited or deleted.",
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
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    title: "No active sprint",
    desc: "If there is no active sprint, the board will be empty. Start a sprint from the Sprints page first.",
  },
];

export default function SprintBoardHelpTooltip() {
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
        aria-label="Sprint board help"
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
              Sprint Board
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