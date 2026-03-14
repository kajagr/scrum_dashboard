"use client";

import { useEffect, useState } from "react";
import CreateUserModal from "@/components/features/users/CreateUserModal";
import type { User } from "@/lib/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => { fetchUsers(); }, []);

  const handleModalClose = () => { setIsModalOpen(false); fetchUsers(); };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading users...</span>
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
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight">Users</h1>
          <p className="text-sm text-muted mt-1">
            {users.length > 0
              ? `${users.length} user${users.length === 1 ? "" : "s"}`
              : "No users yet"}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
        >
          <span className="text-lg leading-none">+</span>
          Add user
        </button>
      </div>

      {users.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {users.map((user, i) => {
            const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "?";
            const isAdmin = user.system_role === "admin";
            return (
              <div
                key={user.id}
                className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-background
                  ${i !== users.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-muted truncate">{user.email}</p>
                    <p className="text-xs text-subtle">@{user.username}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                  isAdmin
                    ? "bg-accent-light text-accent-text border border-accent-border"
                    : "bg-background text-muted border border-border"
                }`}>
                  {user.system_role}
                </span>
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
          <p className="font-semibold text-foreground mb-1">No users yet</p>
          <p className="text-sm text-subtle">Add the first user to get started.</p>
        </div>
      )}

      <CreateUserModal isOpen={isModalOpen} onClose={handleModalClose} />
    </div>
  );
}