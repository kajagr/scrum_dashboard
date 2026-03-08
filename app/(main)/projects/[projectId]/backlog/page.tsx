"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CreateStoryModal from "@/components/features/stories/CreateStoryModal";
import BacklogHelpTooltip from "@/components/features/stories/BacklogHelpTooltip";
import StoryCard from "@/components/features/stories/StoryCard";
import type { UserStory } from "@/lib/types";

type SortKey = "created_at" | "business_value" | "priority";

const PRIORITY_ORDER: Record<string, number> = {
  must_have: 0,
  should_have: 1,
  could_have: 2,
  wont_have: 3,
};

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ReactNode }[] = [
  {
    value: "created_at",
    label: "Date",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    value: "business_value",
    label: "Business value",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    value: "priority",
    label: "Priority",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h12M3 17h6" />
      </svg>
    ),
  },
];

export default function BacklogPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("created_at");

  const loadStories = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/stories`, {
        credentials: "include",
      });
      const data = await res.json();
      setStories(res.ok ? (data ?? []) : []);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadStories(); }, [projectId]);

  const handleModalClose = async () => {
    setIsModalOpen(false);
    await loadStories();
  };

  const sortedStories = useMemo(() => {
    return [...stories].sort((a, b) => {
      if (sortBy === "created_at") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "business_value") {
        return (b.business_value ?? 0) - (a.business_value ?? 0);
      }
      if (sortBy === "priority") {
        return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      }
      return 0;
    });
  }, [stories, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-subtle">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">Backlog</h1>
            <BacklogHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {stories.length > 0
              ? `${stories.length} stor${stories.length === 1 ? "y" : stories.length < 5 ? "ies" : "ies"}`
              : "No stories yet"}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
        >
          <span className="text-lg leading-none">+</span>
          New story
        </button>
      </div>

      {/* Sort toggle */}
      {stories.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-subtle mr-1">Sort by:</span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sortBy === opt.value
                    ? "bg-primary-light text-primary border border-primary-border shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stories list */}
      {sortedStories.length > 0 ? (
        <div className="space-y-3">
          {sortedStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">Backlog is empty</p>
          <p className="text-sm text-subtle">Create your first user story to get started.</p>
        </div>
      )}

      <CreateStoryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
      />
    </div>
  );
}