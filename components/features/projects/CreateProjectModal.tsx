"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User, ProjectRole } from "@/lib/types";
import RoleSelect from "@/components/features/projects/RoleSelect";

interface MemberToAdd {
  user_id: string;
  role: ProjectRole;
}

const ROLES: { value: ProjectRole; label: string }[] = [
  { value: "product_owner", label: "Product Owner" },
  { value: "scrum_master", label: "Scrum Master" },
  { value: "developer", label: "Developer" },
];

// Roles that can only be assigned to one person
const UNIQUE_ROLES: ProjectRole[] = ["product_owner", "scrum_master"];

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MemberToAdd[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(""); setDescription(""); setSelectedMembers([]);
      setUserSearch(""); setStep(1); setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step !== 2) return;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (res.ok) setAvailableUsers(data);
        else setError(data.error || "Failed to load users.");
      } catch { setError("Server connection error."); }
      finally { setLoadingUsers(false); }
    };
    fetchUsers();
  }, [step]);

  const handleNext = () => {
    if (!name.trim()) { setError("Project name is required."); return; }
    if (name.trim().length < 3) { setError("Project name must be at least 3 characters."); return; }
    if (name.trim().length > 100) { setError("Project name must be under 100 characters."); return; }
    setError(null);
    setStep(2);
  };

  const handleAddUser = (userId: string) => {
    if (selectedMembers.find((m) => m.user_id === userId)) return;
    setSelectedMembers([...selectedMembers, { user_id: userId, role: "developer" }]);
  };

  const handleRemoveUser = (userId: string) =>
    setSelectedMembers(selectedMembers.filter((m) => m.user_id !== userId));

  // Role change with uniqueness enforcement
  const handleRoleChange = (userId: string, newRole: ProjectRole) => {
    if (UNIQUE_ROLES.includes(newRole)) {
      const alreadyTaken = selectedMembers.find(
        (m) => m.user_id !== userId && m.role === newRole
      );
      if (alreadyTaken) {
        const takenBy = availableUsers.find((u) => u.id === alreadyTaken.user_id);
        setError(
          `${newRole === "product_owner" ? "Product Owner" : "Scrum Master"} is already assigned to ${takenBy?.first_name} ${takenBy?.last_name}. Only one person can hold this role.`
        );
        return;
      }
    }
    setError(null);
    setSelectedMembers(selectedMembers.map((m) => m.user_id === userId ? { ...m, role: newRole } : m));
  };

  const handleSubmit = async () => {
    const poCount = selectedMembers.filter((m) => m.role === "product_owner").length;
    const smCount = selectedMembers.filter((m) => m.role === "scrum_master").length;
    if (poCount === 0 && smCount === 0) { setError("You must assign a Product Owner and a Scrum Master before creating the project."); return; }
    if (poCount === 0) { setError("You must assign a Product Owner before creating the project."); return; }
    if (smCount === 0) { setError("You must assign a Scrum Master before creating the project."); return; }
    if (poCount > 1) { setError("Only one Product Owner is allowed per project."); return; }
    if (smCount > 1) { setError("Only one Scrum Master is allowed per project."); return; }

    setError(null);
    setSubmitting(true);
    try {
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const projData = await projRes.json();

      if (!projRes.ok) {
        if (projRes.status === 409)
          setError(`A project named "${name.trim()}" already exists. Please choose a different name.`);
        else if (projRes.status === 403)
          setError("You don't have permission to create projects.");
        else
          setError(projData.error || "Failed to create project.");
        setSubmitting(false);
        return;
      }

      if (selectedMembers.length > 0) {
        const membersRes = await fetch(`/api/projects/${projData.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ members: selectedMembers }),
        });
        if (!membersRes.ok) {
          const membersData = await membersRes.json();
          setError(`Project created, but adding members failed: ${membersData.error}`);
          setSubmitting(false);
          router.push(`/projects/${projData.id}`);
          onClose();
          return;
        }
      }

      setSubmitting(false);
      onClose();
      router.push(`/projects/${projData.id}`);
      router.refresh();
    } catch {
      setError("Server connection error.");
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName(""); setDescription(""); setSelectedMembers([]);
    setUserSearch(""); setStep(1); setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const getUserById = (id: string) => availableUsers.find((u) => u.id === id);

  const filteredUsers = availableUsers
    .filter((u) => !selectedMembers.find((m) => m.user_id === u.id))
    .filter((u) => {
      const q = userSearch.toLowerCase();
      return (
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    });

  // Which unique roles are already taken
  const takenRoles = new Set(
    selectedMembers
      .filter((m) => UNIQUE_ROLES.includes(m.role))
      .map((m) => m.role)
  );

  const inputClass =
    "mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 " +
    "bg-background border border-border text-foreground " +
    "placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  const labelClass = "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/30" onClick={handleClose} />

      <div className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl bg-surface max-h-[90vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent rounded-t-2xl flex-shrink-0" />

        <div className="p-7 flex flex-col overflow-visible flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 flex-shrink-0">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
                {step === 1 ? "New project" : "Add team members"}
              </p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                {step === 1 ? "Create project" : name}
              </h2>
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted">×</button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6 flex-shrink-0">
            {([1, 2] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${step === s ? "bg-primary text-white" : step > s ? "bg-primary-light text-primary border border-primary-border" : "bg-background border border-border text-muted"}`}>
                    {step > s ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s}
                  </div>
                  <span className={`text-xs font-medium ${step === s ? "text-foreground" : "text-muted"}`}>
                    {s === 1 ? "Project details" : "Team members"}
                  </span>
                </div>
                {i < 1 && <div className={`w-6 h-px ${step > 1 ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-4 flex-1">
              <div>
                <label className={labelClass}>Project name <span className="text-accent normal-case font-normal tracking-normal">*</span></label>
                <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus placeholder="e.g. Mobile App Redesign" className={inputClass} maxLength={100} />
                <p className="mt-1 text-xs text-subtle text-right">{name.length}/100</p>
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this project about?" className={inputClass + " resize-none"} maxLength={500} />
                <p className="mt-1 text-xs text-subtle text-right">{description.length}/500</p>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4 overflow-visible flex-1">
              {/* Role coverage summary */}
              <div className="flex gap-2 flex-shrink-0">
                {(["product_owner", "scrum_master"] as ProjectRole[]).map((role) => {
                  const taken = takenRoles.has(role);
                  return (
                    <div key={role} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                      ${taken ? "bg-primary-light border-primary-border text-primary" : "bg-background border-border text-subtle"}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={taken ? 3 : 2}>
                        {taken
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          : <circle cx="12" cy="12" r="9" />
                        }
                      </svg>
                      {role === "product_owner" ? "Product Owner" : "Scrum Master"}
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-subtle">
                  {selectedMembers.filter(m => m.role === "developer").length} developer{selectedMembers.filter(m => m.role === "developer").length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Search */}
              <div className="flex-shrink-0">
                <label className={labelClass}>Search users</label>
                <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name, username or email..." className={inputClass} autoFocus />
              </div>

              {/* Available users */}
              <div className="flex-shrink-0">
                <p className={labelClass + " mb-2"}>
                  Available
                  {filteredUsers.length > 0 && <span className="ml-2 normal-case font-normal tracking-normal text-subtle">({filteredUsers.length})</span>}
                </p>
                {loadingUsers ? (
                  <div className="flex items-center gap-2 text-subtle text-xs py-3">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-xs text-subtle py-3">{userSearch ? "No users match your search." : "No available users."}</p>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                    {filteredUsers.map((user, i) => (
                      <button key={user.id} type="button" onClick={() => handleAddUser(user.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary-light
                          ${i < filteredUsers.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="w-7 h-7 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-muted">@{user.username}</p>
                        </div>
                        <svg className="w-4 h-4 text-primary ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected members */}
              {selectedMembers.length > 0 && (
                <div className="flex-1 flex flex-col">
                  <p className={labelClass + " mb-2 flex-shrink-0"}>
                    Selected <span className="ml-2 normal-case font-normal tracking-normal text-subtle">({selectedMembers.length})</span>
                  </p>
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {selectedMembers.map((member) => {
                      const user = getUserById(member.user_id);
                      return (
                        <div key={member.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
                          <div className="w-7 h-7 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {user?.first_name?.[0]}{user?.last_name?.[0]}
                          </div>
                          <span className="text-sm font-medium text-foreground flex-1 truncate">{user?.first_name} {user?.last_name}</span>
                          <RoleSelect
                            value={member.role}
                            onChange={(role) => handleRoleChange(member.user_id, role)}
                            takenRoles={takenRoles}
                            currentMemberRole={member.role}
                          />
                          <button type="button" onClick={() => handleRemoveUser(member.user_id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-error hover:bg-error-light transition-colors flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light flex-shrink-0">
              <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-border mt-5 pt-4 flex justify-between gap-3 flex-shrink-0">
            <button type="button" onClick={step === 1 ? handleClose : () => { setStep(1); setError(null); }}
              className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted">
              {step === 1 ? "Cancel" : "← Back"}
            </button>
            {step === 1 ? (
              <button type="button" onClick={handleNext}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm bg-primary hover:bg-primary-hover">
                Next: Add members →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Creating...
                  </span>
                ) : `Create project${selectedMembers.length > 0 ? ` + ${selectedMembers.length} member${selectedMembers.length > 1 ? "s" : ""}` : ""} →`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}