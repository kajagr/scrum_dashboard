"use client";

import { useState } from "react";
import type { UserStory } from "@/lib/types";
import { formatDateDot } from "@/lib/datetime";
import CreateTaskModal from "./CreateTaskModal";

interface StoryCardProps {
  story: UserStory;
  projectId: string;
  onClick?: () => void;
}

const priorityConfig: Record<
  string,
  {
    label: string;
    pillStyle: React.CSSProperties;
    dotStyle: React.CSSProperties;
  }
> = {
  must_have: {
    label: "Must Have",
    pillStyle: {
      background: "var(--color-error-light)",
      color: "var(--color-error)",
      border: "1px solid var(--color-error-border)",
    },
    dotStyle: {
      background: "var(--color-error)",
    },
  },
  should_have: {
    label: "Should Have",
    pillStyle: {
      background: "var(--color-accent-light)",
      color: "var(--color-accent-text)",
      border: "1px solid var(--color-accent-border)",
    },
    dotStyle: {
      background: "var(--color-accent)",
    },
  },
  could_have: {
    label: "Could Have",
    pillStyle: {
      background: "var(--color-primary-light)",
      color: "var(--color-primary)",
      border: "1px solid var(--color-primary-border)",
    },
    dotStyle: {
      background: "var(--color-primary)",
    },
  },
  wont_have: {
    label: "Won't Have",
    pillStyle: {
      background: "var(--color-surface)",
      color: "var(--color-muted)",
      border: "1px solid var(--color-border)",
    },
    dotStyle: {
      background: "var(--color-subtle)",
    },
  },
};

const statusConfig: Record<
  string,
  {
    label: string;
    pillStyle: React.CSSProperties;
  }
> = {
  backlog: {
    label: "Backlog",
    pillStyle: {
      background: "var(--color-surface)",
      color: "var(--color-muted)",
      border: "1px solid var(--color-border)",
    },
  },
  ready: {
    label: "Ready",
    pillStyle: {
      background: "var(--color-primary-light)",
      color: "var(--color-primary)",
      border: "1px solid var(--color-primary-border)",
    },
  },
  in_progress: {
    label: "In Progress",
    pillStyle: {
      background: "var(--color-accent-light)",
      color: "var(--color-accent-text)",
      border: "1px solid var(--color-accent-border)",
    },
  },
  done: {
    label: "Done",
    pillStyle: {
      background: "var(--color-primary-light)",
      color: "var(--color-primary)",
      border: "1px solid var(--color-primary-border)",
    },
  },
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
        className={`group relative rounded-2xl p-4 transition-all duration-200 ${
          onClick ? "cursor-pointer" : ""
        }`}
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <div
          className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full transition-opacity group-hover:opacity-100"
          style={{
            ...pCfg.dotStyle,
            opacity: 0.4,
          }}
        />

        <div className="pl-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3
              className="flex-1 text-sm font-semibold leading-snug transition-colors"
              style={{ color: "var(--color-foreground)" }}
            >
              {story.title}
            </h3>

            {story.story_points != null && (
              <span
                className="flex-shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold"
                style={{
                  background: "var(--color-background)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-muted)",
                }}
              >
                {story.story_points} pts
              </span>
            )}
          </div>

          {story.description && (
            <p
              className="mb-3 line-clamp-2 text-xs leading-relaxed"
              style={{ color: "var(--color-muted)" }}
            >
              {story.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
              style={pCfg.pillStyle}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={pCfg.dotStyle}
              />
              {pCfg.label}
            </span>

            <span
              className="rounded-full px-2 py-1 text-xs font-medium"
              style={sCfg.pillStyle}
            >
              {sCfg.label}
            </span>

            <div className="ml-auto flex flex-shrink-0 items-center gap-3">
              {story.business_value != null && (
                <span
                  className="text-xs"
                  style={{ color: "var(--color-subtle)" }}
                >
                  BV:{" "}
                  <span
                    className="font-medium"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {story.business_value}
                  </span>
                </span>
              )}

              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--color-subtle)" }}
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {formatDateDot(story.created_at)}
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
            className="rounded-md px-3 py-2 text-sm font-medium transition hover:opacity-90"
            style={{
              background: "var(--color-primary)",
              color: "#ffffff",
              border: "1px solid var(--color-primary-border)",
            }}
          >
            Add task
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