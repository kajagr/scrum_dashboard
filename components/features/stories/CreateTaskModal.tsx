"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  projectId: string;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  storyId,
  projectId,
}: CreateTaskModalProps) {
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [timeEstimate, setTimeEstimate] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!description.trim()) {
      setError("Opis naloge je obvezen.");
      setLoading(false);
      return;
    }

    if (timeEstimate === "" || Number(timeEstimate) <= 0) {
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
          time_estimate: timeEstimate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Napaka pri ustvarjanju naloge.");
        setLoading(false);
        return;
      }

      setDescription("");
      setTimeEstimate("");
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4">
        <h2 className="text-xl font-bold mb-4">Nova naloga</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">
              Opis naloge *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="mt-1 block w-full border rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Ocena časa *
            </label>
            <input
              type="number"
              min="1"
              value={timeEstimate}
              onChange={(e) =>
                setTimeEstimate(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className="mt-1 block w-full border rounded-md p-2"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-md"
            >
              Prekliči
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              {loading ? "Shranjujem..." : "Dodaj nalogo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}