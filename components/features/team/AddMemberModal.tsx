"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User, ProjectRole } from "@/lib/types";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingMemberIds: string[];
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

export default function AddMemberModal({
  isOpen,
  onClose,
  projectId,
  existingMemberIds,
}: AddMemberModalProps) {
  const router = useRouter();

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MemberToAdd[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available users (ki še niso člani)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isOpen) return;
      
      setLoadingUsers(true);
      try {
        const response = await fetch("/api/users");
        
        if (!response.ok) {
          setError("Napaka pri nalaganju uporabnikov.");
          setLoadingUsers(false);
          return;
        }

        const users: User[] = await response.json();
        
        // Filtriraj uporabnike ki še niso člani
        const filtered = users.filter(
          (user) => !existingMemberIds.includes(user.id)
        );
        
        setAvailableUsers(filtered);
      } catch {
        setError("Napaka pri povezavi s strežnikom.");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, existingMemberIds]);

  const handleAddUser = (userId: string) => {
    if (selectedMembers.find((m) => m.user_id === userId)) return;

    setSelectedMembers([
      ...selectedMembers,
      { user_id: userId, role: "developer" },
    ]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.user_id !== userId));
  };

  const handleRoleChange = (userId: string, role: ProjectRole) => {
    setSelectedMembers(
      selectedMembers.map((m) =>
        m.user_id === userId ? { ...m, role } : m
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedMembers.length === 0) {
      setError("Izberi vsaj enega uporabnika.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ members: selectedMembers }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Napaka pri dodajanju članov.");
        setLoading(false);
        return;
      }

      // Reset in zapri
      setSelectedMembers([]);
      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError("Napaka pri povezavi s strežnikom.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedMembers([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const getUserById = (id: string) => availableUsers.find((u) => u.id === id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Dodaj člane v projekt
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seznam uporabnikov za izbiro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Izberi uporabnike
            </label>
            
            {loadingUsers ? (
              <p className="text-gray-500 text-sm">Nalaganje...</p>
            ) : availableUsers.length === 0 ? (
              <p className="text-gray-500 text-sm">Ni razpoložljivih uporabnikov.</p>
            ) : (
              <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                {availableUsers
                  .filter((user) => !selectedMembers.find((m) => m.user_id === user.id))
                  .map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleAddUser(user.id)}
                      className="p-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b last:border-b-0"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-medium">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Izbrani uporabniki z vlogami */}
          {selectedMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Izbrani člani ({selectedMembers.length})
              </label>
              <div className="space-y-2">
                {selectedMembers.map((member) => {
                  const user = getUserById(member.user_id);
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-medium">
                          {user?.first_name?.[0]}{user?.last_name?.[0]}
                        </div>
                        <span className="text-sm font-medium">
                          {user?.first_name} {user?.last_name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value as ProjectRole)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                        
                        <button
                          type="button"
                          onClick={() => handleRemoveUser(member.user_id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-md"
            >
              Prekliči
            </button>
            <button
              type="submit"
              disabled={loading || selectedMembers.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50"
            >
              {loading ? "Dodajanje..." : `Dodaj (${selectedMembers.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}