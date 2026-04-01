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
          d="M10.325 4.317a1 1 0 011.35-.936l.902.36a1 1 0 00.746 0l.902-.36a1 1 0 011.35.936l.11.977a1 1 0 00.57.79l.87.435a1 1 0 01.454 1.336l-.375.91a1 1 0 000 .76l.375.91a1 1 0 01-.454 1.336l-.87.435a1 1 0 00-.57.79l-.11.977a1 1 0 01-1.35.936l-.902-.36a1 1 0 00-.746 0l-.902.36a1 1 0 01-1.35-.936l-.11-.977a1 1 0 00-.57-.79l-.87-.435a1 1 0 01-.454-1.336l.375-.91a1 1 0 000-.76l-.375-.91a1 1 0 01.454-1.336l.87-.435a1 1 0 00.57-.79l.11-.977z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15.5A3.5 3.5 0 1012 8.5a3.5 3.5 0 000 7z"
        />
      </svg>
    ),
    title: "What is the Settings page?",
    desc: "The Settings page shows the basic configuration of the current project.",
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
          d="M9 12h6m-7 4h8m-9-8h10"
        />
      </svg>
    ),
    title: "Project details",
    desc: "This section displays the current project name and description.",
  },
 
 
];

export default function SettingsHelpTooltip() {
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
        aria-label="Settings help"
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
              Project settings
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