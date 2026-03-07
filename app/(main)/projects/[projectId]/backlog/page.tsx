"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CreateStoryModal from "@/components/features/stories/CreateStoryModal";
import StoryCard from "@/components/features/stories/StoryCard";
import type { UserStory } from "@/lib/types";

export default function BacklogPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadStories = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/stories`, {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Error fetching stories:", data.error);
        setStories([]);
        return;
      }

      setStories(data || []);
    } catch (error) {
      console.error("Error fetching stories:", error);
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStories();
  }, [projectId]);

  const handleModalClose = async () => {
    setIsModalOpen(false);
    await loadStories();
  };

  if (loading) {
    return (
      <div>
        <p className="text-gray-500">Nalaganje...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backlog</h1>
          <p className="text-gray-600">
            Manage your product backlog and user stories
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Create Story
        </button>
      </div>

       <div className="space-y-4">
        {stories.length > 0 ? (
          stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              projectId={projectId}
            />
          ))
        ) : (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            <p>Ni še user stories.</p>
            <p className="text-sm">Ustvari prvo zgodbo za začetek.</p>
          </div>
        )}
      </div>

      <CreateStoryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
      />
    </div>
  );
}
