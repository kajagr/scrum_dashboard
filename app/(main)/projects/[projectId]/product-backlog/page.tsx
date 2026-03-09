"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StoryCard from "@/components/features/stories/StoryCard";
import type { UserStory } from "@/lib/types";

type SprintInfo = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type BacklogResponse = {
  activeSprint: SprintInfo | null;
  realized: UserStory[];
  assigned: UserStory[];
  unassigned: UserStory[];
};

export default function ProductBacklogPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSprint, setActiveSprint] = useState<SprintInfo | null>(null);
  const [realized, setRealized] = useState<UserStory[]>([]);
  const [assigned, setAssigned] = useState<UserStory[]>([]);
  const [unassigned, setUnassigned] = useState<UserStory[]>([]);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const loadBacklog = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/backlog`, {
        method: "GET",
        credentials: "include",
      });

      const data: BacklogResponse | { error?: string } = await res.json();

      if (!res.ok) {
        setError(
          "error" in data && data.error
            ? data.error
            : "Napaka pri pridobivanju product backloga.",
        );
        setRealized([]);
        setAssigned([]);
        setUnassigned([]);
        setActiveSprint(null);
        return;
      }

      const backlogData = data as BacklogResponse;

      setActiveSprint(backlogData.activeSprint ?? null);
      setRealized(backlogData.realized ?? []);
      setAssigned(backlogData.assigned ?? []);
      setUnassigned(backlogData.unassigned ?? []);
    } catch {
      setError("Prišlo je do napake na strežniku.");
      setRealized([]);
      setAssigned([]);
      setUnassigned([]);
      setActiveSprint(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBacklog();
  }, [projectId]);

  const toggleStorySelection = (storyId: string) => {
    setSelectedStoryIds((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : [...prev, storyId],
    );
  };

  const handleAssignToActiveSprint = async () => {
    if (selectedStoryIds.length === 0) return;

    try {
      setAssigning(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/backlog/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          storyIds: selectedStoryIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Napaka pri dodeljevanju zgodb sprintu.");
        return;
      }

      setSelectedStoryIds([]);
      await loadBacklog();
    } catch {
      setError("Prišlo je do napake na strežniku.");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div>
        <p className="text-gray-500">Nalaganje product backloga...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Backlog</h1>
        <p className="text-gray-600">
          Pregled realiziranih in nerealiziranih uporabniških zgodb.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* REALIZED */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Realizirane zgodbe
            </h2>
            <p className="text-sm text-gray-600">
              Zgodbe, ki imajo status <span className="font-medium">done</span>.
            </p>
          </div>

          <div className="space-y-4">
            {realized.length > 0 ? (
              realized.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))
            ) : (
              <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
                Ni realiziranih zgodb.
              </div>
            )}
          </div>
        </section>

        {/* UNREALIZED */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Nerealizirane zgodbe
            </h2>
            <p className="text-sm text-gray-600">
              Razdeljene na dodeljene aktivnemu sprintu in nedodeljene.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ASSIGNED */}
            <div>
              <div className="mb-3">
                <h3 className="text-lg font-medium text-gray-900">Dodeljene</h3>
                <p className="text-sm text-gray-600">
                  {activeSprint
                    ? `Aktivni sprint: ${activeSprint.name}`
                    : "Trenutno ni aktivnega sprinta."}
                </p>
              </div>

              <div className="space-y-4">
                {assigned.length > 0 ? (
                  assigned.map((story) => (
                    <div key={story.id} className="space-y-2">
                      <div className="text-xs text-gray-500">
                        Sprint:{" "}
                        <span className="font-medium text-gray-700">
                          {activeSprint?.name ?? "Aktivni sprint"}
                        </span>
                      </div>
                      <StoryCard story={story} />
                    </div>
                  ))
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
                    Ni zgodb, dodeljenih aktivnemu sprintu.
                  </div>
                )}
              </div>
            </div>

            {/* UNASSIGNED */}
            <div>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Nedodeljene
                  </h3>
                  <p className="text-sm text-gray-600">
                    Te zgodbe je mogoče izbrati in dodeliti aktivnemu sprintu.
                  </p>
                </div>

                {selectedStoryIds.length > 0 && (
                  <button
                    onClick={handleAssignToActiveSprint}
                    disabled={!activeSprint || assigning}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {assigning ? "Dodajanje..." : "Add to active sprint"}
                  </button>
                )}
              </div>

              {selectedStoryIds.length > 0 && (
                <div className="mb-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
                  Izbranih zgodb: {selectedStoryIds.length}
                  {!activeSprint && (
                    <span className="ml-2 text-red-600">
                      Ni aktivnega sprinta.
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {unassigned.length > 0 ? (
                  unassigned.map((story) => {
                    const isSelected = selectedStoryIds.includes(story.id);

                    return (
                      <div
                        key={story.id}
                        className={`rounded-lg border p-3 ${
                          isSelected
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStorySelection(story.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <StoryCard story={story} />
                          </div>
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
                    Ni nedodeljenih zgodb.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
