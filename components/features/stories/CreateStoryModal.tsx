"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Priority } from "@/lib/types";

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function CreateStoryModal({
  isOpen,
  onClose,
  projectId,
}: CreateStoryModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [priority, setPriority] = useState<Priority>("should_have");
  const [storyPoints, setStoryPoints] = useState<number | "">("");
  const [businessValue, setBusinessValue] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (businessValue === "") {
      setError("Business value obvezen.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/stories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          acceptance_criteria: acceptanceCriteria,
          priority,
          story_points: storyPoints === "" ? null : storyPoints,
          business_value: businessValue,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Napaka pri ustrvarjanju user story.");
        setLoading(false);
        return;
      }

      setTitle("");
      setDescription("");
      setAcceptanceCriteria("");
      setPriority("should_have");
      setStoryPoints("");
      setBusinessValue("");
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

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Nova User Story
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700"
            >
              Naslov *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="Kot uporabnik želim..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Opis
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="acceptanceCriteria"
              className="block text-sm font-medium text-gray-700"
            >
              Sprejemni kriteriji
            </label>
            <textarea
              id="acceptanceCriteria"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              rows={3}
              placeholder="- Kriterij 1&#10;- Kriterij 2"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="priority"
                className="block text-sm font-medium text-gray-700"
              >
                Prioriteta
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="must_have">Must Have</option>
                <option value="should_have">Should Have</option>
                <option value="could_have">Could Have</option>
                <option value="wont_have">Wont Have</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="storyPoints"
                className="block text-sm font-medium text-gray-700"
              >
                Story Points
              </label>
              <input
                id="storyPoints"
                type="number"
                min="0"
                value={storyPoints}
                onChange={(e) =>
                  setStoryPoints(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="businessValue"
              className="block text-sm font-medium text-gray-700"
            >
              Business Value *
            </label>
            <input
              id="businessValue"
              type="number"
              min="1"
              max="100"
              value={businessValue}
              onChange={(e) =>
                setBusinessValue(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              placeholder="1 - 100"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-md"
            >
              Prekliči
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50"
            >
              {loading ? "Ustvarjanje..." : "Ustvari"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
