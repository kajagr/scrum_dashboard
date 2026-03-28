"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AddMemberModal from "@/components/features/team/AddMemberModal";
import TeamHelpTooltip from "@/components/features/team/TeamHelpTooltip";
import { ProjectRole } from "@/lib/types";

interface MemberWithUser {
  id: string;
  user_id: string;
  role: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

const VALID_ROLES: ProjectRole[] = [
  "product_owner",
  "scrum_master",
  "developer",
];

const roleConfig: Record<string, { label: string; className: string }> = {
  product_owner: {
    label: "Product Owner",
    className: "bg-accent-light text-accent-text border border-accent-border",
  },
  scrum_master: {
    label: "Scrum Master",
    className: "bg-primary-light text-primary border border-primary-border",
  },
  developer: {
    label: "Team Member",
    className: "bg-surface text-muted border border-border",
  },
};

const roleLabel = (r: string) => roleConfig[r]?.label ?? r;

function getHealthIssues(members: MemberWithUser[]): string[] {
  const issues: string[] = [];
  const owners = members.filter((m) => m.role === "product_owner").length;
  const masters = members.filter((m) => m.role === "scrum_master").length;
  if (owners === 0)
    issues.push("Project has no Product Owner. Please assign one.");
  if (owners > 1)
    issues.push(
      `Project has ${owners} Product Owners. Please demote one to Team Member.`,
    );
  if (masters === 0)
    issues.push("Project has no Scrum Master. Please assign one.");
  if (masters > 1)
    issues.push(
      `Project has ${masters} Scrum Masters. Please demote one to Team Member.`,
    );
  return issues;
}

export default function TeamPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [healthIssues, setHealthIssues] = useState<string[]>([]);
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const isHealthy = healthIssues.length === 0;

  // Check if current user can manage (admin or scrum_master)
  useEffect(() => {
    if (!projectId) return;
    async function checkPermission() {
      const [meRes, roleRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/members/me`, { cache: "no-store" }),
      ]);
      const me = meRes.ok ? await meRes.json() : null;
      const role = roleRes.ok ? await roleRes.json() : null;
      setCanManage(
        me?.system_role === "admin" || role?.role === "scrum_master",
      );
    }
    checkPermission();
  }, [projectId]);

  // Block browser back/reload when unhealthy
  useEffect(() => {
    if (isHealthy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isHealthy]);

  const fetchMembers = async () => {
    try {
      const [membersRes, meRes, roleRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/members`, { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/members/me`, { cache: "no-store" }),
      ]);
      if (!membersRes.ok) {
        const data = await membersRes.json();
        setError(data.error || "Failed to load members.");
        setLoading(false);
        return;
      }
      const data: MemberWithUser[] = await membersRes.json();
      setMembers(data);
      setHealthIssues(getHealthIssues(data));
      window.dispatchEvent(new CustomEvent("projectHealthChanged"));

      // Re-check own permissions after every role change
      const me = meRes.ok ? await meRes.json() : null;
      const role = roleRes.ok ? await roleRes.json() : null;
      setCanManage(
        me?.system_role === "admin" || role?.role === "scrum_master",
      );
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleModalClose = () => {
    setIsModalOpen(false);
    fetchMembers();
  };

  async function handleRoleSelect(
    member: MemberWithUser,
    newRole: ProjectRole,
  ) {
    setActionError(null);
    setEditingRoleFor(null);
    if (newRole === member.role) return;

    const res = await fetch(
      `/api/projects/${projectId}/members/${member.user_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error ?? "Failed to update role.");
      return;
    }
    fetchMembers();
  }

  async function handleRemove(userId: string) {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setActionError(null);
    const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error ?? "Failed to remove member.");
      return;
    }
    fetchMembers();
  }

  const existingMemberIds = members.map((m) => m.user_id);
  const existingRoles = Object.fromEntries(
    members.map((m) => [m.user_id, m.role as ProjectRole]),
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-subtle">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span className="text-sm">Loading team...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
          <span className="text-error text-base mt-0.5">⚠</span>
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Project
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              Team
            </h1>
            <TeamHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {members.length > 0
              ? `${members.length} member${members.length === 1 ? "" : "s"}`
              : "No members yet"}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
          >
            <span className="text-lg leading-none">+</span>
            Add member
          </button>
        )}
      </div>

      {/* Health issues banner (non-dismissable) */}
      {!isHealthy && (
        <div className="mb-4 p-4 rounded-xl border-2 border-error-border bg-error-light">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-error text-lg">⚠</span>
            <p className="text-sm font-semibold text-error">
              Project role configuration is incomplete. Resolve the issues below
              before continuing.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {healthIssues.map((issue, i) => (
              <li key={i} className="text-sm text-error">
                {issue}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-error opacity-75">
            Navigation to other project pages is disabled until this is
            resolved.
          </p>
        </div>
      )}

      {/* Action error banner */}
      {actionError && (
        <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-xl border border-error-border bg-error-light">
          <span className="text-error text-base mt-0.5">⚠</span>
          <p className="text-sm text-error">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-error text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Members list */}
      {members.length > 0 ? (
        <div className="rounded-2xl border border-border overflow-hidden">
          {members.map((member, i) => {
            const cfg = roleConfig[member.role] ?? roleConfig.developer;
            const initials = `${member.user?.first_name?.[0] ?? ""}${member.user?.last_name?.[0] ?? ""}`;
            const isEditing = editingRoleFor === member.user_id;

            return (
              <div
                key={member.id}
                className={`flex items-center justify-between px-5 py-4 bg-surface transition-colors hover:bg-background
                  ${i < members.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-sm font-bold text-primary">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {member.user?.first_name} {member.user?.last_name}
                    </p>
                    <p className="text-xs text-muted">{member.user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={member.role}
                        autoFocus
                        onChange={(e) =>
                          handleRoleSelect(
                            member,
                            e.target.value as ProjectRole,
                          )
                        }
                        className="text-xs rounded-md px-2 py-1 border border-border bg-background text-foreground"
                      >
                        {VALID_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingRoleFor(null)}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${cfg.className}`}
                      >
                        {cfg.label}
                      </span>
                      {canManage && (
                        <>
                          <button
                            onClick={() => {
                              setActionError(null);
                              setEditingRoleFor(member.user_id);
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground hover:border-primary transition-colors"
                          >
                            Change role
                          </button>
                          <button
                            onClick={() => handleRemove(member.user_id)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-error-border text-error hover:bg-error-light transition-colors"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="font-semibold text-foreground mb-1">
            No team members yet
          </p>
          <p className="text-sm text-subtle">
            Add your first member to get started.
          </p>
        </div>
      )}

      <AddMemberModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        existingMemberIds={existingMemberIds}
        existingRoles={existingRoles}
      />
    </div>
  );
}
