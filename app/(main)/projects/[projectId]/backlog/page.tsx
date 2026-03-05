"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CreateStoryModal from "@/components/features/stories/CreateStoryModal";
import StoryCard from "@/components/features/stories/StoryCard";
import type { UserStory } from "@/lib/types";

export default function BacklogPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const supabase = createClient();

  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const loadStories = async () => {
      const { data, error } = await supabase
        .from("user_stories")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true });

      if (error) {
        console.error("Error fetching stories:", error);
      } else {
        setStories(data || []);
      }
      setLoading(false);
    };

    loadStories();
  }, [supabase, projectId]);

  const handleModalClose = async () => {
    setIsModalOpen(false);
    // Refresh stories
    const { data } = await supabase
      .from("user_stories")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true });
    setStories(data || []);
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
          <p className="text-gray-600">Manage your product backlog and user stories</p>
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
            <StoryCard key={story.id} story={story} />
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