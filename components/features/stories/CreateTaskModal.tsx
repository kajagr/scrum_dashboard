"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  projectId: string;
}

interface ProjectMember {
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

export default function CreateTaskModal({
  isOpen,
  onClose,
  storyId,
  projectId,
}: CreateTaskModalProps) {
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number | "">("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Naloži člane projekta (samo developerji)
  useEffect(() => {
    const fetchMembers = async () => {
      if (!isOpen) return;
      
      setLoadingMembers(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/members`, {
          credentials: "include",
        });

        if (res.ok) {
          const data: ProjectMember[] = await res.json();
          // Filtriraj developerje in scrum masterje
          const assignable = data.filter((m) => m.role === "developer" || m.role === "scrum_master");
          setMembers(assignable);
        }
      } catch {
        console.error("Napaka pri nalaganju članov.");
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [isOpen, projectId]);

  const resetForm = () => {
    setDescription("");
    setEstimatedHours("");
    setAssigneeId("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!description.trim()) {
      setError("Opis naloge je obvezen.");
      setLoading(false);
      return;
    }

    if (estimatedHours === "" || Number(estimatedHours) <= 0) {
      setError("Ocena časa mora biti večja od 0.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/stories/${storyId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          description,
          estimated_hours: estimatedHours,
          assignee_id: assigneeId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Napaka pri ustvarjanju naloge.");
        setLoading(false);
        return;
      }

      resetForm();
      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError("Prišlo je do napake na strežniku.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Nova naloga</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Opis naloge *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Opišite nalogo..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ocena časa (ure) *
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={estimatedHours}
              onChange={(e) =>
                setEstimatedHours(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              placeholder="npr. 4"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Predlagan član ekipe (neobvezno)
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Brez dodelitve --</option>
              {loadingMembers ? (
                <option disabled>Nalaganje...</option>
              ) : (
                members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user?.first_name} {member.user?.last_name} ({member.user?.email})
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Član mora nalogo še sprejeti, preden mu je dodeljena.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50"
            >
              {loading ? "Shranjujem..." : "Dodaj nalogo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}