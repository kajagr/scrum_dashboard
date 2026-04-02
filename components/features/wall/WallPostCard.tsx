"use client";

import { useState } from "react";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

type WallPostCardProps = {
  id: string;
  author: { id: string; first_name: string; last_name: string } | null;
  content: string;
  created_at: string;
  projectId: string;
  isScrumMaster?: boolean;
  onDeleted?: (id: string) => void;
  initialCommentCount?: number;
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Avatar({
  firstName,
  lastName,
  size = "md",
}: {
  firstName?: string;
  lastName?: string;
  size?: "sm" | "md";
}) {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span
      className={`${size === "sm" ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]"} rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center font-bold flex-shrink-0`}
    >
      {initials}
    </span>
  );
}

export default function WallPostCard({
  id,
  author,
  content,
  created_at,
  projectId,
  isScrumMaster,
  onDeleted,
  initialCommentCount = 0,
}: WallPostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);

  const loadComments = async () => {
    if (loaded) return;
    setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wall/${id}/comments`,
        { credentials: "include" },
      );
      if (res.ok) setComments(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoadingComments(false);
      setLoaded(true);
    }
  };

  const handleToggle = async () => {
    if (!expanded) await loadComments();
    setExpanded((p) => !p);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wall/${id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: commentText.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error posting comment.");
        return;
      }
      setComments((prev) => [...prev, data]);
      setCommentText("");
    } catch {
      setError("A server error occurred.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async () => {
    setDeletingPost(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wall/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onDeleted?.(id);
      else {
        const data = await res.json();
        setError(data.error || "Error deleting post.");
      }
    } catch {
      setError("A server error occurred.");
    } finally {
      setDeletingPost(false);
      setConfirmDeletePost(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingCommentId(commentId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wall/${id}/comments/${commentId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
      else {
        const data = await res.json();
        setError(data.error || "Error deleting comment.");
      }
    } catch {
      setError("A server error occurred.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="flex gap-5">
      {/* Timeline dot */}
      <div className="relative flex-shrink-0 mt-4">
        <div className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20" />
      </div>

      {/* Card */}
      <div className="flex-1 rounded-2xl border border-border bg-surface hover:border-subtle transition-colors">
        {/* Post content */}
        <div className="p-4">
          <div className="flex items-center gap-2.5 mb-2.5">
            <Avatar
              firstName={author?.first_name}
              lastName={author?.last_name}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground leading-tight">
                {author
                  ? `${author.first_name} ${author.last_name}`
                  : "Unknown"}
              </p>
              <p className="text-xs text-muted">{timeAgo(created_at)}</p>
            </div>
            {isScrumMaster &&
              (confirmDeletePost ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">
                    Delete post + all comments?
                  </span>
                  <button
                    onClick={handleDeletePost}
                    disabled={deletingPost}
                    className="px-2 py-1 text-xs font-semibold rounded-lg bg-error-light text-error border border-error-border hover:bg-error/20 disabled:opacity-50 transition-colors"
                  >
                    {deletingPost ? "..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmDeletePost(false)}
                    className="px-2 py-1 text-xs font-semibold rounded-lg bg-background text-muted border border-border hover:border-subtle transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeletePost(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-error hover:bg-error-light transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
              ))}
          </div>
          <div
            className="text-sm text-foreground leading-relaxed mb-3 prose prose-sm max-w-none
              prose-p:my-1 prose-headings:text-foreground prose-headings:font-semibold
              prose-strong:text-foreground prose-ul:my-1 prose-ol:my-1
              prose-blockquote:border-primary-border prose-blockquote:text-muted
              [&_p:empty]:h-[1.25em] [&_p:empty]:block"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* Toggle comments */}
          <button
            onClick={handleToggle}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            {expanded
              ? "Hide comments"
              : `${loaded ? comments.length : initialCommentCount} comment${(loaded ? comments.length : initialCommentCount) === 1 ? "" : "s"}`}
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Comments section */}
        {expanded && (
          <div className="border-t border-border bg-background rounded-b-2xl px-4 py-3 space-y-3">
            {loadingComments ? (
              <div className="flex items-center gap-2 text-muted py-2">
                <svg
                  className="animate-spin h-3.5 w-3.5"
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
                <span className="text-xs">Loading comments...</span>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5">
                    <Avatar
                      firstName={comment.author?.first_name}
                      lastName={comment.author?.last_name}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          {comment.author
                            ? `${comment.author.first_name} ${comment.author.last_name}`
                            : "Unknown"}
                        </span>
                        <span className="text-[10px] text-muted">
                          {timeAgo(comment.created_at)}
                        </span>
                        {isScrumMaster && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={deletingCommentId === comment.id}
                            className="ml-auto w-5 h-5 flex items-center justify-center rounded text-muted hover:text-error hover:bg-error-light transition-colors disabled:opacity-50"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted py-1">
                No comments yet. Be the first!
              </p>
            )}

            {/* New comment form */}
            <form onSubmit={handleComment} className="flex gap-2 pt-1">
              <textarea
                value={commentText}
                onChange={(e) => {
                  setCommentText(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleComment(e as any);
                  }
                }}
                placeholder="Write a comment..."
                rows={1}
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-surface border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-all"
              />
              <button
                type="submit"
                disabled={posting || !commentText.trim()}
                className="px-3 py-2 text-xs font-semibold text-white rounded-xl transition-colors disabled:opacity-50 bg-primary hover:bg-primary-hover flex-shrink-0"
              >
                {posting ? (
                  <svg
                    className="animate-spin h-3.5 w-3.5"
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
                ) : (
                  "Post"
                )}
              </button>
            </form>
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
