"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectRole } from "@/lib/types";

interface RoleOption {
  value: ProjectRole;
  label: string;
  disabled?: boolean;
}

interface RoleSelectProps {
  value: ProjectRole;
  onChange: (role: ProjectRole) => void;
  takenRoles: Set<string>;
  currentMemberRole: ProjectRole; // the role this member currently has
}

const ROLES: RoleOption[] = [
  { value: "product_owner", label: "Product Owner" },
  { value: "scrum_master", label: "Scrum Master" },
  { value: "developer", label: "Developer" },
];

const UNIQUE_ROLES: ProjectRole[] = ["product_owner", "scrum_master"];

const roleStyle: Record<ProjectRole, { pill: string; dot: string }> = {
  product_owner: {
    pill: "bg-accent-light text-accent-text border-accent-border",
    dot: "bg-accent",
  },
  scrum_master: {
    pill: "bg-primary-light text-primary border-primary-border",
    dot: "bg-primary",
  },
  developer: {
    pill: "bg-background text-muted border-border",
    dot: "bg-subtle",
  },
};

export default function RoleSelect({
  value,
  onChange,
  takenRoles,
  currentMemberRole,
}: RoleSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const current = roleStyle[value];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-lg border text-xs font-medium transition-colors ${current.pill}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${current.dot}`} />
        {ROLES.find((r) => r.value === value)?.label}
        <svg
          className={`w-3 h-3 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-border bg-surface shadow-lg shadow-black/30 overflow-hidden">
          {ROLES.map((role) => {
            const isTaken =
              UNIQUE_ROLES.includes(role.value) &&
              takenRoles.has(role.value) &&
              currentMemberRole !== role.value;
            const isSelected = value === role.value;
            const style = roleStyle[role.value];

            return (
              <button
                key={role.value}
                type="button"
                disabled={isTaken}
                onClick={() => {
                  if (!isTaken) { onChange(role.value); setOpen(false); }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-left transition-colors
                  ${isTaken ? "opacity-35 cursor-not-allowed" : "hover:bg-background cursor-pointer"}
                  ${isSelected ? "bg-background" : ""}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                <span className={isSelected ? "text-foreground font-semibold" : "text-muted"}>
                  {role.label}
                </span>
                {isTaken && (
                  <span className="ml-auto text-subtle text-[10px]">taken</span>
                )}
                {isSelected && !isTaken && (
                  <svg className="ml-auto w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
