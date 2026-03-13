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
        setError(data.error || "Failed to load users.");
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleModalClose = () => {
    setIsModalOpen(false);
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-[var(--color-muted)]">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div
          className="rounded-xl px-4 py-3"
          style={{
            border: "1px solid var(--color-error-border)",
            background: "var(--color-error-light)",
            color: "var(--color-error)",
          }}
        >
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-[var(--color-foreground)]">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            Users
          </h1>
          <p className="text-[var(--color-muted)]">
            Manage system users
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            background: "var(--color-primary)",
            color: "#ffffff",
            border: "1px solid var(--color-primary-border)",
          }}
          className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition hover:opacity-90"
        >
          + Add user
        </button>
      </div>

      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {users.length > 0 ? (
          users.map((user, index) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4"
              style={{
                borderBottom:
                  index < users.length - 1
                    ? "1px solid var(--color-border)"
                    : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full font-medium"
                  style={{
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    border: "1px solid var(--color-primary-border)",
                  }}
                >
                  {user.first_name?.[0]}
                  {user.last_name?.[0]}
                </div>

                <div>
                  <p className="font-medium text-[var(--color-foreground)]">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {user.email}
                  </p>
                  <p className="text-xs text-[var(--color-subtle)]">
                    @{user.username}
                  </p>
                </div>
              </div>

              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium capitalize"
                style={
                  user.system_role === "admin"
                    ? {
                        background: "var(--color-accent-light)",
                        color: "var(--color-accent-text)",
                        border: "1px solid var(--color-accent-border)",
                      }
                    : {
                        background: "var(--color-background)",
                        color: "var(--color-muted)",
                        border: "1px solid var(--color-border)",
                      }
                }
              >
                {user.system_role}
              </span>
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className="text-[var(--color-muted)]">No users yet.</p>
          </div>
        )}
      </div>

      <CreateUserModal isOpen={isModalOpen} onClose={handleModalClose} />
    </div>
  );
}