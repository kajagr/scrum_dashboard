"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User, ProjectRole } from "@/lib/types";
import RoleSelect from "@/components/features/projects/RoleSelect";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingMemberIds: string[];
  existingRoles?: Record<string, ProjectRole>; // userId → role for already-assigned roles
}

interface MemberToAdd {
  user_id: string;
  role: ProjectRole;
}

const ROLES: { value: ProjectRole; label: string }[] = [
  { value: "product_owner", label: "Product Owner" },
  { value: "scrum_master", label: "Scrum Master" },
  { value: "developer", label: "Developer" },
];

const UNIQUE_ROLES: ProjectRole[] = ["product_owner", "scrum_master"];

export default function AddMemberModal({
  isOpen,
  onClose,
  projectId,
  existingMemberIds,
  existingRoles = {},
}: AddMemberModalProps) {
  const router = useRouter();

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MemberToAdd[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch("/api/users");
        if (!res.ok) { setError("Failed to load users."); setLoadingUsers(false); return; }
        const users: User[] = await res.json();
        setAvailableUsers(users.filter((u) => !existingMemberIds.includes(u.id)));
      } catch { setError("Server connection error."); }
      finally { setLoadingUsers(false); }
    };
    fetchUsers();
  }, [isOpen, existingMemberIds]);

  const handleAddUser = (userId: string) => {
    if (selectedMembers.find((m) => m.user_id === userId)) return;
    setSelectedMembers([...selectedMembers, { user_id: userId, role: "developer" }]);
  };

  const handleRemoveUser = (userId: string) =>
    setSelectedMembers(selectedMembers.filter((m) => m.user_id !== userId));

  const handleRoleChange = (userId: string, newRole: ProjectRole) => {
    if (UNIQUE_ROLES.includes(newRole)) {
      // Check if role is already taken by an existing project member
      const takenByExisting = Object.entries(existingRoles).find(([, r]) => r === newRole);
      if (takenByExisting) {
        setError(`${newRole === "product_owner" ? "Product Owner" : "Scrum Master"} is already assigned in this project. Only one person can hold this role.`);
        return;
      }
      // Check if taken by another newly selected member
      const takenBySelected = selectedMembers.find((m) => m.user_id !== userId && m.role === newRole);
      if (takenBySelected) {
        const takenUser = availableUsers.find((u) => u.id === takenBySelected.user_id);
        setError(`${newRole === "product_owner" ? "Product Owner" : "Scrum Master"} is already assigned to ${takenUser?.first_name} ${takenUser?.last_name}.`);
        return;
      }
    }
    setError(null);
    setSelectedMembers(selectedMembers.map((m) => m.user_id === userId ? { ...m, role: newRole } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.length === 0) { setError("Select at least one user."); return; }

    // Final validation
    const poCount = selectedMembers.filter((m) => m.role === "product_owner").length +
      Object.values(existingRoles).filter((r) => r === "product_owner").length;
    const smCount = selectedMembers.filter((m) => m.role === "scrum_master").length +
      Object.values(existingRoles).filter((r) => r === "scrum_master").length;

    if (poCount > 1) { setError("Only one Product Owner is allowed per project."); return; }
    if (smCount > 1) { setError("Only one Scrum Master is allowed per project."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: selectedMembers }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to add members."); setLoading(false); return; }

      setSelectedMembers([]);
      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError("Server connection error.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedMembers([]); setError(null); setUserSearch("");
    onClose();
  };

  if (!isOpen) return null;

  const getUserById = (id: string) => availableUsers.find((u) => u.id === id);

  const filteredUsers = availableUsers
    .filter((u) => !selectedMembers.find((m) => m.user_id === u.id))
    .filter((u) => {
      const q = userSearch.toLowerCase();
      return u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
    });

  // Roles already taken (existing + newly selected)
  const takenRoles = new Set([
    ...Object.values(existingRoles).filter((r) => UNIQUE_ROLES.includes(r)),
    ...selectedMembers.filter((m) => UNIQUE_ROLES.includes(m.role)).map((m) => m.role),
  ]);

  const inputClass =
    "mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 " +
    "bg-background border border-border text-foreground " +
    "placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  const labelClass = "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/30" onClick={handleClose} />

      <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface max-h-[90vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent flex-shrink-0" />

        <div className="p-7 flex flex-col overflow-hidden flex-1">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">Project team</p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">Add members</h2>
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted">×</button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden flex-1">
            {/* Role coverage */}
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
            </div>

            {/* Search */}
            <div className="flex-shrink-0">
              <label className={labelClass}>Search users</label>
              <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name or username..." className={inputClass} autoFocus />
            </div>

            {/* Available */}
            <div className="flex-shrink-0">
              <p className={labelClass + " mb-2"}>Available</p>
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
                <div className="border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {filteredUsers.map((user, i) => (
                    <button key={user.id} type="button" onClick={() => handleAddUser(user.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary-light ${i < filteredUsers.length - 1 ? "border-b border-border" : ""}`}>
                      <div className="w-7 h-7 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-muted">@{user.username}</p>
                      </div>
                      <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected */}
            {selectedMembers.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col">
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

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light flex-shrink-0">
                <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="border-t border-border pt-4 flex justify-end gap-3 flex-shrink-0">
              <button type="button" onClick={handleClose} className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted">Cancel</button>
              <button type="submit" disabled={loading || selectedMembers.length === 0}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Adding...
                  </span>
                ) : `Add ${selectedMembers.length > 0 ? `(${selectedMembers.length})` : "members"} →`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
