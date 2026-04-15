"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
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

function getHealthIssues(members: MemberWithUser[]): { key: string; count?: number }[] {
  const issues: { key: string; count?: number }[] = [];
  const owners = members.filter((m) => m.role === "product_owner").length;
  const masters = members.filter((m) => m.role === "scrum_master").length;
  if (owners === 0) issues.push({ key: "noProductOwner" });
  if (owners > 1) issues.push({ key: "tooManyProductOwners", count: owners });
  if (masters === 0) issues.push({ key: "noScrumMaster" });
  if (masters > 1) issues.push({ key: "tooManyScrumMasters", count: masters });
  return issues;
}

export default function TeamPage() {
  const t = useTranslations("team");
  const params = useParams();
  const projectId = params.projectId as string;

  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [healthIssues, setHealthIssues] = useState<{ key: string; count?: number }[]>([]);
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const isHealthy = healthIssues.length === 0;

  const translatedRoleConfig: Record<string, { label: string; className: string }> = {
    product_owner: { label: t("roles.product_owner"), className: roleConfig.product_owner.className },
    scrum_master: { label: t("roles.scrum_master"), className: roleConfig.scrum_master.className },
    developer: { label: t("roles.developer"), className: roleConfig.developer.className },
  };

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

  function isRoleTakenByAnotherMember(
    targetRole: ProjectRole,
    currentMember: MemberWithUser,
  ) {
    if (targetRole === "developer") return false;

    return members.some(
      (m) => m.user_id !== currentMember.user_id && m.role === targetRole,
    );
  }

  function getRoleWarning(
    targetRole: ProjectRole,
    currentMember: MemberWithUser,
  ) {
    if (!isRoleTakenByAnotherMember(targetRole, currentMember)) return null;

    

    return null;
  }

  async function handleRoleSelect(
    member: MemberWithUser,
    newRole: ProjectRole,
  ) {
    setActionError(null);
    setEditingRoleFor(null);

    if (newRole === member.role) return;

    if (isRoleTakenByAnotherMember(newRole, member)) {
      setActionError(getRoleWarning(newRole, member) ?? "Role already taken.");
      return;
    }

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
    if (!confirm(t("confirmRemove"))) return;

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
        <span className="text-sm">{t("loading")}</span>
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
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            {t("section")}
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              {t("title")}
            </h1>
            <TeamHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {members.length > 0
              ? t("memberCount", { count: members.length })
              : t("noMembersYet")}
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
          >
            <span className="text-lg leading-none">+</span>
            {t("addMember")}
          </button>
        )}
      </div>

      {/* Health issues */}
      {!isHealthy && (
        <div className="mb-4 rounded-xl border border-error-border bg-error-light p-4">
          <div className="flex items-start gap-2.5">
            <span className="text-error text-base mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-error mb-2">
                {t("healthIncomplete")}
              </p>
              <ul className="list-disc list-inside space-y-1">
                {healthIssues.map((issue, i) => (
                  <li key={i} className="text-sm text-error">
                    {t(`health.${issue.key}`, issue.count !== undefined ? { count: issue.count } : {})}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-error opacity-75">
                {t("healthDisabledNav")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-xl border border-error-border bg-error-light">
          <span className="text-error text-base mt-0.5">⚠</span>
          <p className="text-sm text-error">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-error text-xs underline"
          >
            {t("dismiss")}
          </button>
        </div>
      )}

      {/* Members list */}
      {members.length > 0 ? (
        <div className="space-y-3">
          {members.map((member) => {
            const cfg = translatedRoleConfig[member.role] ?? translatedRoleConfig.developer;
            const initials = `${member.user?.first_name?.[0] ?? ""}${member.user?.last_name?.[0] ?? ""}`;
            const isEditing = editingRoleFor === member.user_id;

            const scrumMasterBlocked = getRoleWarning("scrum_master", member);
            const productOwnerBlocked = getRoleWarning("product_owner", member);

            return (
              <div
                key={member.id}
                className="rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {member.user?.first_name} {member.user?.last_name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {member.user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <div className="flex flex-col items-end gap-2">
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
                            className="text-xs rounded-lg px-2.5 py-1.5 border border-border bg-background text-foreground"
                          >
                            {VALID_ROLES.map((r) => {
                              const warning = getRoleWarning(r, member);
                              const disabled =
                                r !== member.role &&
                                isRoleTakenByAnotherMember(r, member);

                              return (
                                <option
                                  key={r}
                                  value={r}
                                  disabled={disabled}
                                  title={warning ?? undefined}
                                >
                                  {translatedRoleConfig[r]?.label ?? r}
                                  {disabled ? ` — ${t("alreadyAssigned")}` : ""}
                                </option>
                              );
                            })}
                          </select>

                          <button
                            onClick={() => setEditingRoleFor(null)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-error-border bg-error-light text-error hover:bg-error-light/80 transition-colors"
                          >
                            {t("cancel")}
                          </button>
                        </div>

                        {(scrumMasterBlocked || productOwnerBlocked) && (
                          <div className="text-right">
                            {scrumMasterBlocked && member.role !== "scrum_master" && (
                              <p className="text-[11px] text-error">
                                {scrumMasterBlocked}
                              </p>
                            )}
                            {productOwnerBlocked && member.role !== "product_owner" && (
                              <p className="text-[11px] text-error">
                                {productOwnerBlocked}
                              </p>
                            )}
                          </div>
                        )}
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
                              {t("changeRole")}
                            </button>
                            <button
                              onClick={() => handleRemove(member.user_id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-error-border bg-error-light text-error hover:bg-error-light/80 transition-colors"
                            >
                              {t("remove")}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 bg-surface border-border">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 20a6 6 0 00-12 0M12 12a4 4 0 100-8 4 4 0 000 8zm7 8a7.5 7.5 0 00-3-5.99M5 14.01A7.5 7.5 0 002 20"
              />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">{t("empty.title")}</p>
          <p className="text-sm text-subtle">
            {canManage
              ? t("empty.canManage")
              : t("empty.cannotManage")}
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