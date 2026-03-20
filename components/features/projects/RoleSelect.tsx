"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectRole } from "@/lib/types";

interface RoleOption {
  value: ProjectRole;
  label: string;
}

interface RoleSelectProps {
  value: ProjectRole;
  onChange: (role: ProjectRole) => void;
  takenRoles: Set<string>;
  currentMemberRole: ProjectRole;
}

const ROLES: RoleOption[] = [
  { value: "product_owner", label: "Product Owner" },
  { value: "scrum_master", label: "Scrum Master" },
  { value: "developer", label: "Team Member" },
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
  const [openUpward, setOpenUpward] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 160);
    }
    setOpen((o) => !o);
  };

  const current = roleStyle[value];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-lg border text-xs font-medium transition-colors ${current.pill}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${current.dot}`}
        />
        {ROLES.find((r) => r.value === value)?.label}
        <svg
          className={`w-3 h-3 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute right-0 z-[9999] w-44 rounded-xl border border-border bg-surface shadow-xl shadow-black/40 overflow-hidden
          ${openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
          style={{
            position: "fixed",
            top: openUpward
              ? undefined
              : (() => {
                  const r = btnRef.current?.getBoundingClientRect();
                  return r ? r.bottom + 6 : 0;
                })(),
            bottom: openUpward
              ? (() => {
                  const r = btnRef.current?.getBoundingClientRect();
                  return r ? window.innerHeight - r.top + 6 : 0;
                })()
              : undefined,
            right: (() => {
              const r = btnRef.current?.getBoundingClientRect();
              return r ? window.innerWidth - r.right : 0;
            })(),
          }}
        >
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
                  if (!isTaken) {
                    onChange(role.value);
                    setOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-left transition-colors
                  ${isTaken ? "opacity-35 cursor-not-allowed" : "hover:bg-background cursor-pointer"}
                  ${isSelected ? "bg-background" : ""}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`}
                />
                <span
                  className={
                    isSelected ? "text-foreground font-semibold" : "text-muted"
                  }
                >
                  {role.label}
                </span>
                {isTaken && (
                  <span className="ml-auto text-subtle text-[10px]">taken</span>
                )}
                {isSelected && !isTaken && (
                  <svg
                    className="ml-auto w-3 h-3 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
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
