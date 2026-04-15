"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import CreateUserModal from "@/components/features/users/CreateUserModal";
import EditUserModal from "@/components/features/users/EditUserModal";
import UsersHelpTooltip from "@/components/features/users/UsersHelpTooltip";
import type { User } from "@/lib/types";

export default function AdminUsersPage() {
  const t = useTranslations("users");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Error loading users.");
        setLoading(false);
        return;
      }
      setUsers(data);
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) setCurrentUserId(data.id);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const handleCreateClose = () => {
    setIsCreateModalOpen(false);
    fetchUsers();
  };

  const handleEditClose = () => {
    setEditUser(null);
    fetchUsers();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Error deleting user.");
        return;
      }
      setDeleteUser(null);
      fetchUsers();
    } catch {
      setDeleteError("A server error occurred.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">{t("loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
          <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">{t("section")}</p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">{t("title")}</h1>
            <UsersHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {users.length > 0 ? t("userCount", { count: users.length }) : t("noUsersYet")}
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
        >
          <span className="text-lg leading-none">+</span>
          {t("addUser")}
        </button>
      </div>

      {users.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {users.map((user, i) => {
            const initials =
              `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "?";
            const isAdmin = user.system_role === "admin";
            const isSelf = user.id === currentUserId;

            return (
              <div
                key={user.id}
                className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-background
                  ${i !== users.length - 1 ? "border-b border-border" : ""}`}
              >
                {/* Avatar + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {user.first_name} {user.last_name}
                      {isSelf && <span className="ml-2 text-xs font-normal text-muted">{t("you")}</span>}
                    </p>
                    <p className="text-xs text-muted truncate">{user.email}</p>
                    <p className="text-xs text-subtle">@{user.username}</p>
                  </div>
                </div>

                {/* Role badge + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isAdmin
                        ? "bg-accent-light text-accent-text border border-accent-border"
                        : "bg-background text-muted border border-border"
                    }`}
                  >
                    {user.system_role}
                  </span>

                  {/* Edit */}
                  <button
                    onClick={() => setEditUser(user)}
                    className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
                    title={t("editUser")}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </button>

                  {/* Delete — disabled for self */}
                  <button
                    onClick={() => { setDeleteError(null); setDeleteUser(user); }}
                    disabled={isSelf}
                    className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={isSelf ? t("cannotDeleteSelf") : t("deleteUser")}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">{t("empty.title")}</p>
          <p className="text-sm text-subtle">{t("empty.addFirst")}</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={() => !deleteLoading && setDeleteUser(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
            <div className="h-1 w-full bg-gradient-to-r from-error to-error-border" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-error-light border border-error-border flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{t("deleteTitle")}</h3>
                  <p className="text-sm text-muted">{t("cannotUndo")}</p>
                </div>
              </div>

              <p className="text-sm text-foreground mb-1">
                {t("deleteConfirm", { name: `${deleteUser.first_name} ${deleteUser.last_name}` })}
              </p>
              <p className="text-xs text-subtle mb-5">@{deleteUser.username} · {deleteUser.email}</p>

              {deleteError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-error-border bg-error-light mb-4">
                  <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-sm text-error">{deleteError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteUser(null)}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-error hover:bg-error/90"
                >
                  {deleteLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {t("deleting")}
                    </span>
                  ) : t("deleteUser")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateUserModal isOpen={isCreateModalOpen} onClose={handleCreateClose} />
      <EditUserModal isOpen={!!editUser} onClose={handleEditClose} user={editUser} />
    </div>
  );
}