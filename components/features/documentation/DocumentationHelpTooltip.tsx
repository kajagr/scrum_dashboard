"use client";

import { useEffect, useRef, useState } from "react";

const helpItems = [
  {
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
        />
      </svg>
    ),
    title: "Editing",
    body: "All project members can edit the documentation. Changes are saved automatically 2 seconds after you stop typing.",
  },
  {
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
        />
      </svg>
    ),
    title: "Formatting",
    body: "Use the toolbar to apply headings, bold, italic, strikethrough, lists, blockquotes, and horizontal rules.",
  },
  {
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
        />
      </svg>
    ),
    title: "Import",
    body: "Import a .md or .txt file to replace the current documentation. You will be asked to confirm before the content is replaced.",
  },
  {
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
        />
      </svg>
    ),
    title: "Export",
    body: "Export as .md, .txt, or .pdf. Note: .txt files do not support formatting (bold, italic, etc.). Markdown (.md) files do not preserve multiple consecutive blank lines.",
  },
];

export default function DocumentationHelpTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
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
          ${
            open
              ? "bg-primary border-primary text-white"
              : "bg-surface border-border text-muted hover:border-primary hover:text-primary"
          }`}
      >
        ?
      </button>

      {open && (
        <div className="absolute left-0 top-8 z-50 w-80 rounded-2xl border border-border bg-surface shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-background">
            <p className="text-xs font-bold tracking-widest uppercase text-primary">
              How documentation works
            </p>
          </div>
          <div className="divide-y divide-border">
            {helpItems.map((item) => (
              <div key={item.title} className="flex gap-3 px-5 py-3.5">
                <span className="mt-0.5 flex-shrink-0 text-primary">
                  {item.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    {item.body}
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
