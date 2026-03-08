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
        setError(data.error || "Napaka pri nalaganju uporabnikov.");
        setLoading(false);
        return;
      }

      setUsers(data);
    } catch {
      setError("Napaka pri povezavi s strežnikom.");
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
        <p className="text-gray-500">Nalaganje...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Uporabniki</h1>
          <p className="text-gray-600">Upravljaj uporabnike sistema</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          + Dodaj uporabnika
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {users.length > 0 ? (
          users.map((user) => (
            <div
              key={user.id}
              className="p-4 border-b border-gray-200 last:border-b-0 flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-medium">
                  {user.first_name?.[0]}
                  {user.last_name?.[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <p className="text-xs text-gray-400">@{user.username}</p>
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded ${
                  user.system_role === "admin"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {user.system_role}
              </span>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>Ni še uporabnikov.</p>
          </div>
        )}
      </div>

      <CreateUserModal isOpen={isModalOpen} onClose={handleModalClose} />
    </div>
  );
}