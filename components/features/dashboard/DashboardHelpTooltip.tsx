"use client";

import { useEffect, useRef, useState } from "react";

const helpItems = [
  {
    icon: (
      <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l6.75-6.75 4.5 4.5L21 4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 4.5H21v3.75" />
      </svg>
    ),
    title: "What is the dashboard?",
    desc: "The dashboard gives a quick overview of the project — including sprint progress, story statistics, and team activity.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-8" />
      </svg>
    ),
    title: "Burn-Down chart",
    desc: "Shows sprint progress over time. Tracks three lines: Ideal (expected progress), Remaining (estimated hours left), and Logged (cumulative hours spent). Use the dropdown to switch between sprints.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
    title: "Statistics — Story status",
    desc: "A donut chart showing how stories are distributed across statuses: In active sprint, Ready for review, Done, Unassigned, and Future releases.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V4H2v16h5m10 0v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5m10 0H7" />
      </svg>
    ),
    title: "Statistics — Hours per member",
    desc: "A bar chart showing logged hours per team member. Switch between 'This sprint' and 'All time' to compare workload distribution.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Statistics — Sprint velocity",
    desc: "Compares estimated vs. logged hours across all sprints. The active sprint is highlighted in green.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "User Stories & Sprints",
    desc: "The summary cards at the top show total user stories, number of sprints, and team members in the project.",
  },
];

export default function DashboardHelpTooltip() {
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
        aria-label="Dashboard help"
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
              Dashboard overview
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