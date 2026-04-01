// This component runs in the browser because it uses useState, useEffect,
// useParams and event handlers — none of which work on the server.
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WallCompose from "@/components/features/wall/WallCompose";
import WallPostCard from "@/components/features/wall/WallPostCard";
import WallSidebar from "@/components/features/wall/WallSideBar";

type WallPost = {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

export default function WallPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [posts, setPosts] = useState<WallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/wall`, { credentials: "include" });
      if (res.ok) setPosts(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, [projectId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/wall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error posting."); return; }
      setContent("");
      setPosts((prev) => [data, ...prev]);
    } catch {
      setError("A server error occurred.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
        <h1 className="text-3xl font-bold text-foreground leading-tight">Project Wall</h1>
        <p className="text-sm text-muted mt-1">
          {posts.length > 0 ? `${posts.length} post${posts.length === 1 ? "" : "s"}` : "Share updates with your team"}
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          <WallCompose
            content={content}
            onChange={(v) => { setContent(v); setError(null); }}
            onSubmit={handlePost}
            posting={posting}
            error={error}
          />

          {loading ? (
            <div className="flex items-center gap-2 text-muted py-4">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">Loading posts...</span>
            </div>
          ) : posts.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-5">
                {posts.map((post) => (
                  <WallPostCard
                    key={post.id}
                    author={post.author}
                    content={post.content}
                    created_at={post.created_at}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-border bg-surface">
              <div className="w-14 h-14 rounded-2xl border border-border bg-background flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="font-semibold text-foreground mb-1">No posts yet</p>
              <p className="text-sm text-muted">Be the first to share an update.</p>
            </div>
          )}
        </div>

        <WallSidebar posts={posts} />
      </div>
    </div>
  );
}