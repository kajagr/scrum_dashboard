"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AddMemberModal from "@/components/features/team/AddMemberModal";

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

export default function TeamPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Napaka pri nalaganju članov.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setMembers(data);
    } catch {
      setError("Napaka pri povezavi s strežnikom.");
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

  if (loading) {
    return (
      <div>
        <p className="text-gray-500">Nalaganje...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const existingMemberIds = members.map((m) => m.user_id);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-600">Manage project members and roles</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Add Member
        </button>
      </div>

      {/* Team members */}
      <div className="bg-white rounded-lg border border-gray-200">
        {members.length > 0 ? (
          members.map((member) => (
            <div
              key={member.id}
              className="p-4 border-b border-gray-200 last:border-b-0 flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-medium">
                  {member.user?.first_name?.[0]}
                  {member.user?.last_name?.[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {member.user?.first_name} {member.user?.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{member.user?.email}</p>
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded ${
                  member.role === "product_owner"
                    ? "bg-purple-100 text-purple-800"
                    : member.role === "scrum_master"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {member.role.replace("_", " ")}
              </span>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>Ni še članov.</p>
          </div>
        )}
      </div>

      <AddMemberModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        existingMemberIds={existingMemberIds}
      />
    </div>
  );
}