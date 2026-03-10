"use client";

import { useState } from "react";
import type { UserStory } from "@/lib/types";
import CreateTaskModal from "./CreateTaskModal";

interface StoryCardProps {
  story: UserStory;
  projectId: string;
  onClick?: () => void;
}

const priorityConfig = {
  must_have:   { label: "Must Have",   dot: "bg-error",   pill: "bg-error-light text-error border-error-border" },
  should_have: { label: "Should Have", dot: "bg-accent",  pill: "bg-accent-light text-accent-text border-accent-border" },
  could_have:  { label: "Could Have",  dot: "bg-primary", pill: "bg-primary-light text-primary border-primary-border" },
  wont_have:   { label: "Won't Have",  dot: "bg-subtle",  pill: "bg-surface text-muted border-border" },
};

const statusConfig = {
  backlog:     { label: "Backlog",      pill: "bg-surface text-muted border-border" },
  ready:       { label: "Ready",        pill: "bg-primary-light text-primary border-primary-border" },
  in_progress: { label: "In Progress",  pill: "bg-accent-light text-accent-text border-accent-border" },
  done:        { label: "Done",         pill: "bg-primary-light text-primary border-primary-border" },
};

export default function StoryCard({
  story,
  projectId,
  onClick,
}: StoryCardProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  const pCfg = priorityConfig[story.priority] ?? priorityConfig.should_have;
  const sCfg = statusConfig[story.status as keyof typeof statusConfig] ?? statusConfig.backlog;

  return (
    <>
      <div
        onClick={onClick}
        className={`group relative rounded-2xl border border-border bg-surface p-4 transition-all duration-200
          hover:border-primary hover:shadow-md hover:shadow-primary/10
          ${onClick ? "cursor-pointer" : ""}`}
      >
        {/* Left accent */}
        <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full opacity-40 group-hover:opacity-100 transition-opacity ${pCfg.dot}`} />

        <div className="pl-3">
          {/* Top row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors flex-1">
              {story.title}
            </h3>
            {story.story_points != null && (
              <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-lg bg-background border border-border text-muted">
                {story.story_points} pts
              </span>
            )}
          </div>

          {/* Description */}
          {story.description && (
            <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-3">
              {story.description}
            </p>
          )}

          {/* Footer badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border ${pCfg.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
              {pCfg.label}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${sCfg.pill}`}>
              {sCfg.label}
            </span>
            <div className="ml-auto flex items-center gap-3 flex-shrink-0">
              {story.business_value != null && (
                <span className="text-xs text-subtle">
                  BV: <span className="text-muted font-medium">{story.business_value}</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-subtle">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {new Date(story.created_at).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsTaskModalOpen(true);
            }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
          >
            Dodaj nalogo
          </button>
        </div>
      </div>

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        storyId={story.id}
        projectId={projectId}
      />
    </>
  );
}