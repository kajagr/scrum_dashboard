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
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    ),
    title: "What is Planning Poker?",
    desc: "Planning Poker is a team estimation session where members vote on the effort required for the selected user story.",
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
          d="M8 10h.01M12 10h.01M16 10h.01M9 16h6M7 4h10a2 2 0 012 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z"
        />
      </svg>
    ),
    title: "How voting works",
    desc: "Each active team member chooses one card value to estimate the story. Votes stay hidden until all non-absent members vote.",
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
          d="M9 17v-2a4 4 0 014-4h4M15 7h6m0 0v6m0-6L10 18"
        />
      </svg>
    ),
    title: "Multiple rounds",
    desc: "If estimates differ too much, the Scrum Master can start another round so the team can discuss and vote again.",
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
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
    title: "Suggested and final estimate",
    desc: "When everyone votes, the system can suggest an estimate. The Scrum Master can then confirm or adjust the final story points.",
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
          d="M17 20h5V4H2v16h5m10 0v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5m10 0H7"
        />
      </svg>
    ),
    title: "Absent members",
    desc: "The Scrum Master can mark participants as absent. Absent members are excluded from vote progress and do not block the round.",
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
          d="M13 16h-1v-4h-1m1-4h.01M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"
        />
      </svg>
    ),
    title: "Story details panel",
    desc: "The story card on the right shows the title, description, acceptance criteria, status, priority, and current story points.",
  },
];

export default function PlanningPokerHelpTooltip() {
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
        aria-label="Planning Poker help"
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
              Planning Poker
            </p>
          </div>

          <div className="p-3 space-y-1 max-h-[28rem] overflow-y-auto">
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