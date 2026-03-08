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
    label: "Developer",
    className: "bg-surface text-muted border border-border",
  },
};

export default function TeamPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load members.");
        setLoading(false);
        return;
      }
      setMembers(await res.json());
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, [projectId]);

  const handleModalClose = () => { setIsModalOpen(false); fetchMembers(); };

  const existingMemberIds = members.map((m) => m.user_id);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-subtle">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
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
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight">Team</h1>
          <p className="text-sm text-muted mt-1">
            {members.length > 0
              ? `${members.length} member${members.length === 1 ? "" : "s"}`
              : "No members yet"}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
        >
          <span className="text-lg leading-none">+</span>
          Add member
        </button>
      </div>

      {/* Members list */}
      {members.length > 0 ? (
        <div className="rounded-2xl border border-border overflow-hidden">
          {members.map((member, i) => {
            const cfg = roleConfig[member.role] ?? roleConfig.developer;
            const initials = `${member.user?.first_name?.[0] ?? ""}${member.user?.last_name?.[0] ?? ""}`;
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
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${cfg.className}`}>
                  {cfg.label}
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
          <p className="font-semibold text-foreground mb-1">No team members yet</p>
          <p className="text-sm text-subtle">Add your first member to get started.</p>
        </div>
      )}

      <AddMemberModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        existingMemberIds={existingMemberIds}
      />
    </div>
  );
}
