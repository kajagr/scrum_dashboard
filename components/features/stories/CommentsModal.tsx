"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateTimeDot } from "@/lib/datetime";

interface Author {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: Author | null;
}

interface CommentsModalProps {
  storyId: string;
  storyTitle: string;
  isDone?: boolean;
  onClose: () => void;
}

export default function CommentsModal({
  storyId,
  storyTitle,
  isDone = false,
  onClose,
}: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/stories/${storyId}/comments`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load comments.");
        return;
      }
      setComments(data);
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [storyId]);

  // Scroll to bottom when new comments load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add comment.");
        return;
      }
      setContent("");
      setComments((prev) => [...prev, data]);
    } catch {
      setError("Server connection error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm bg-foreground/30"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface max-h-[85vh] flex flex-col">
        {/* Gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent flex-shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
              Comments
            </p>
            <h2 className="text-lg font-bold text-foreground leading-tight line-clamp-1">
              {storyTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted ml-3 flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-subtle">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-sm">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-muted">No comments yet</p>
              <p className="text-xs text-subtle mt-1">
                Be the first to add one.
              </p>
            </div>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="flex gap-3 p-3 rounded-xl bg-background border border-border"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {c.author?.first_name?.[0] ?? "?"}
                  {c.author?.last_name?.[0] ?? ""}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground">
                      {c.author
                        ? `${c.author.first_name} ${c.author.last_name}`
                        : "Unknown"}
                    </span>
                    <span className="text-[10px] text-subtle">
                      {formatDateTimeDot(c.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 flex items-start gap-2 p-3 rounded-xl border border-error-border bg-error-light flex-shrink-0">
            <span className="text-error text-sm mt-0.5">⚠</span>
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Input form — skrito za done zgodbe */}
        {isDone ? (
          <div className="px-6 pb-5 pt-3 border-t border-border flex-shrink-0">
            <p className="text-xs text-muted text-center py-1">
              This story is completed — new comments cannot be added.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="px-6 pb-5 pt-3 border-t border-border flex-shrink-0"
          >
            <div className="flex gap-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }
                }}
                placeholder="Add a comment... (Enter to submit, Shift+Enter for new line)"
                rows={2}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 self-end"
              >
                {submitting ? "..." : "Post"}
              </button>
            </div>
            <p className="text-[10px] text-subtle mt-1.5">
              {comments.length} comment{comments.length !== 1 ? "s" : ""}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
