"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CreateStoryModal from "@/components/features/stories/CreateStoryModal";
import BacklogHelpTooltip from "@/components/features/stories/BacklogHelpTooltip";
import type { UserStory } from "@/lib/types";
import EditStoryModal from "@/components/features/stories/EditStoryModal";
import CommentsModal from "@/components/features/stories/CommentsModal";
import { formatDateDot } from "@/lib/datetime";

type SortKey = "created_at" | "business_value" | "priority";
type TabKey = "unassigned" | "assigned" | "ready" | "realized" | "future";

const PRIORITY_ORDER: Record<string, number> = {
  must_have: 0,
  should_have: 1,
  could_have: 2,
  wont_have: 3,
};

const PRIORITY_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  must_have: { label: "Must Have", pill: "bg-error-light text-error border border-error-border", dot: "bg-error" },
  should_have: { label: "Should Have", pill: "bg-accent-light text-accent-text border border-accent-border", dot: "bg-accent" },
  could_have: { label: "Could Have", pill: "bg-primary-light text-primary border border-primary-border", dot: "bg-primary" },
  wont_have: { label: "Won't Have", pill: "bg-background text-muted border border-border", dot: "bg-subtle" },
};

const STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  backlog: { label: "Backlog", pill: "bg-background text-muted border border-border" },
  ready: { label: "Ready", pill: "bg-primary-light text-primary border border-primary-border" },
  in_progress: { label: "In Progress", pill: "bg-accent-light text-accent-text border border-accent-border" },
  done: { label: "Done", pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]" },
};

type SprintInfo = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  velocity: number | null;
};

type BacklogResponse = {
  activeSprint: SprintInfo | null;
  realized: UserStory[];
  assigned: UserStory[];
  unassigned: UserStory[];
};

// Extended UserStory type with optional unfinished sprint info from backend
type UserStoryWithSprintInfo = UserStory & {
  unfinished_sprint_info?: {
    sprint_name: string;
    days_ago: number;
  };
  realized_sprint_info?: {
    sprint_name: string;
  };
};

// ── Sprint Filter Dropdown ───────────────────────────────────────────────────
function SprintFilterDropdown({
  sprints,
  selected,
  onChange,
}: {
  sprints: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (name: string) => {
    const next = new Set(selected);
    next.has(name) ? next.delete(name) : next.add(name);
    onChange(next);
  };

  const label = selected.size === 0
    ? "All sprints"
    : selected.size === 1
    ? [...selected][0]
    : `${selected.size} sprints selected`;

  return (
    <div className="relative mb-4" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surface text-xs font-medium text-foreground hover:border-primary transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        {label}
        {selected.size > 0 && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary text-white">{selected.size}</span>
        )}
        <svg className={`w-3 h-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">Filter by sprint</span>
            {selected.size > 0 && (
              <button onClick={() => onChange(new Set())} className="text-xs text-primary hover:underline ml-2">Clear</button>
            )}
          </div>
          {sprints.map((name) => (
            <button
              key={name}
              onClick={() => toggle(name)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-left hover:bg-background transition-colors"
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                ${selected.has(name) ? "bg-primary border-primary" : "border-subtle"}`}>
                {selected.has(name) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={selected.has(name) ? "text-foreground font-semibold" : "text-muted"}>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Story Card ────────────────────────────────────────────────────────────────
function StoryCard({
  story,
  selectable,
  selected,
  onToggle,
  onEdit,
  canEdit,
  onComments,
  canEstimate,
  onEstimateSubmit,
  canConfirmReject,
  actionLoading,
  actionError,
  onConfirm,
  onReject,
  onPoker,
  onJoinPoker,
  activeSessionId,
  reviewSprintName,
}: {
  story: UserStoryWithSprintInfo;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  onEdit?: (story: UserStory) => void;
  canEdit?: boolean;
  onComments?: (story: UserStory) => void;
  canEstimate?: boolean;
  onEstimateSubmit?: (points: number) => Promise<{ error?: string }>;
  canConfirmReject?: boolean;
  actionLoading?: string | null;
  actionError?: string;
  onConfirm?: () => void;
  onReject?: () => void;
  onPoker?: () => void;
  onJoinPoker?: () => void;
  activeSessionId?: string | null;
  reviewSprintName?: string;
}) {
  const [estimating, setEstimating] = useState(false);
  const [estimateVal, setEstimateVal] = useState("");
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.wont_have;
  const status = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;
  const missingPoints = selectable && story.story_points == null;
  const clickable = selectable && !missingPoints;
  const isLoading = actionLoading === story.id;

  const handleEstimateSubmit = async () => {
    const pts = Number(estimateVal);
    if (!Number.isFinite(pts) || pts <= 0) { setEstimateError("Must be a positive number."); return; }
    setEstimateLoading(true);
    setEstimateError(null);
    const result = await onEstimateSubmit?.(pts);
    setEstimateLoading(false);
    if (result?.error) { setEstimateError(result.error); }
    else { setEstimating(false); setEstimateVal(""); }
  };

  return (
    <div
      onClick={clickable && !estimating ? onToggle : undefined}
      title={missingPoints && !canEstimate ? "Story points must be set before assigning to a sprint" : undefined}
      className={`rounded-xl border transition-all
        ${clickable && !estimating ? "cursor-pointer" : ""}
        ${missingPoints && !canEstimate ? "opacity-50 cursor-not-allowed" : ""}
        ${selected ? "bg-primary-light border-primary-border shadow-sm" : "bg-background border-border hover:border-subtle"}`}
    >
      <div className="flex items-start gap-3 p-4">
        {selectable && (
          <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
            ${missingPoints ? "border-subtle opacity-40" : selected ? "bg-primary border-primary" : "border-subtle"}`}>
            {selected && !missingPoints && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-foreground leading-snug">{story.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canConfirmReject && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onConfirm?.(); }}
                    disabled={isLoading}
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)] hover:bg-[rgba(52,211,153,0.2)] disabled:opacity-50"
                  >
                    {isLoading ? "..." : "✓ Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onReject?.(); }}
                    disabled={isLoading}
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors bg-error-light text-error border border-error-border hover:bg-error/20 disabled:opacity-50"
                  >
                    ✕ Reject
                  </button>
                </>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit?.(story); }}
                  className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onComments?.(story); }}
                className="inline-flex items-center rounded-lg bg-surface border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:border-primary transition-colors"
              >
                Comments
              </button>
              {story.business_value != null && (
                <span className="text-xs text-muted bg-surface border border-border px-2 py-0.5 rounded-lg">BV {story.business_value}</span>
              )}
              {story.story_points != null ? (
                <span className="text-xs text-muted bg-surface border border-border px-2 py-0.5 rounded-lg">{story.story_points} pts</span>
              ) : canEstimate ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEstimating(true); }}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent-light border border-accent-border px-2.5 py-0.5 text-xs font-semibold text-accent-text hover:bg-accent/20 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Estimate
                </button>
              ) : selectable ? (
                <span className="text-xs text-error bg-error-light border border-error-border px-2 py-0.5 rounded-lg">No SP</span>
              ) : null}
              {canEstimate && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPoker?.(); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-primary-border text-primary bg-primary-light hover:bg-primary/20 transition-colors"
                >
                  🃏 Planning Poker
                </button>
              )}
              {activeSessionId && !canEstimate && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onJoinPoker?.(); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-accent-border text-accent-text bg-accent-light hover:bg-accent/20 transition-colors"
                >
                  🃏 Join Poker
                </button>
              )}
            </div>
          </div>

          {story.description && (
            <p className="text-xs text-muted mb-2.5 line-clamp-2">{story.description}</p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priority.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
              {priority.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.pill}`}>
              {status.label}
            </span>
            {/* Shown on done stories — which sprint confirmed them */}
            {story.realized_sprint_info && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {story.realized_sprint_info.sprint_name}
              </span>
            )}
            {/* Shown on ready-for-review stories — which sprint they came from */}
            {reviewSprintName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-light text-primary border border-primary-border">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {reviewSprintName}
              </span>
            )}
          </div>
          {actionError && (
            <p className="text-xs text-error mt-1">{actionError}</p>
          )}
        </div>
      </div>

      {estimating && (
        <div className="px-4 pb-4 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold text-foreground mb-2">Set story points estimate</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number" min="1" step="1" value={estimateVal}
              onChange={(e) => { setEstimateVal(e.target.value); setEstimateError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleEstimateSubmit(); if (e.key === "Escape") { setEstimating(false); setEstimateVal(""); } }}
              placeholder="e.g. 5" autoFocus
              className="w-24 px-3 py-1.5 rounded-lg text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button type="button" onClick={handleEstimateSubmit} disabled={estimateLoading || !estimateVal} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 transition-colors">
              {estimateLoading ? "Saving..." : "Set estimate"}
            </button>
            <button type="button" onClick={() => { setEstimating(false); setEstimateVal(""); setEstimateError(null); }} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
          {estimateError && <p className="text-xs text-error mt-1.5">{estimateError}</p>}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created_at", label: "Date" },
  { value: "business_value", label: "Business value" },
  { value: "priority", label: "Priority" },
];

function useSorted(stories: UserStoryWithSprintInfo[], sortBy: SortKey) {
  return useMemo(
    () =>
      [...stories].sort((a, b) => {
        if (sortBy === "created_at") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === "business_value") return (b.business_value ?? 0) - (a.business_value ?? 0);
        if (sortBy === "priority") return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        return 0;
      }),
    [stories, sortBy],
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BacklogPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSprint, setActiveSprint] = useState<SprintInfo | null>(null);
  const [realized, setRealized] = useState<UserStoryWithSprintInfo[]>([]);
  const [assigned, setAssigned] = useState<UserStoryWithSprintInfo[]>([]);
  const [unassigned, setUnassigned] = useState<UserStoryWithSprintInfo[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("unassigned");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);
  const [commentingStory, setCommentingStory] = useState<UserStory | null>(null);
  const [activePokerSessions, setActivePokerSessions] = useState<Record<string, string>>({});

  // Confirm/reject state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [rejectStory, setRejectStory] = useState<UserStory | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [filterSprints, setFilterSprints] = useState<Set<string>>(new Set());

  const loadBacklog = async () => {
    try {
      setLoading(true);
      setError(null);
      const [backlogRes, memberRes, pokerRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/backlog`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/members/me`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/poker`, { credentials: "include" }),
      ]);

      if (!backlogRes.ok) {
        const d = await backlogRes.json();
        setError(d.error || "Failed to load backlog.");
        return;
      }

      const [backlogData, memberData, pokerData] = await Promise.all([
        backlogRes.json(),
        memberRes.ok ? memberRes.json() : null,
        pokerRes.ok ? pokerRes.json() : null,
      ]);

      setActiveSprint(backlogData.activeSprint ?? null);
      setRealized(backlogData.realized ?? []);
      setAssigned(backlogData.assigned ?? []);
      setUnassigned(backlogData.unassigned ?? []);

      if (memberData?.role) setProjectRole(memberData.role);

      if (pokerData?.sessions) {
        const map: Record<string, string> = {};
        pokerData.sessions.forEach((s: { user_story_id: string; id: string }) => {
          map[s.user_story_id] = s.id;
        });
        setActivePokerSessions(map);
      }
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBacklog(); }, [projectId]);

  const refreshPokerSessions = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/poker`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.sessions) {
        const map: Record<string, string> = {};
        data.sessions.forEach((s: { user_story_id: string; id: string }) => {
          map[s.user_story_id] = s.id;
        });
        setActivePokerSessions(map);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const interval = setInterval(() => { void refreshPokerSessions(); }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadPokerSessions = async (stories: UserStory[]) => {
    const results = await Promise.all(
      stories.map(async (s) => {
        try {
          const res = await fetch(`/api/stories/${s.id}/poker`, { credentials: "include" });
          if (!res.ok) return null;
          const data = await res.json();
          return data.session ? { storyId: s.id, sessionId: data.session.id } : null;
        } catch {
          return null;
        }
      })
    );
    const map: Record<string, string> = {};
    results.forEach((r) => { if (r) map[r.storyId] = r.sessionId; });
    setActivePokerSessions(map);
  };

  const handleEstimate = async (storyId: string, points: number): Promise<{ error?: string }> => {
    try {
      const res = await fetch(`/api/stories/${storyId}/estimate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ story_points: points }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Failed to set estimate." };
      await loadBacklog();
      return {};
    } catch {
      return { error: "Server connection error." };
    }
  };

  const handleStartPoker = async (storyId: string) => {
    try {
      const res = await fetch(`/api/stories/${storyId}/poker`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Error starting Planning Poker.");
        return;
      }
      router.push(`/projects/${projectId}/poker/${data.id}`);
    } catch {
      alert("Server connection error.");
    }
  };

  const handleJoinPoker = (sessionId: string) => {
    router.push(`/projects/${projectId}/poker/${sessionId}`);
  };

  const handleConfirm = async (story: UserStory) => {
    setActionLoading(story.id);
    setActionError((prev) => ({ ...prev, [story.id]: "" }));
    try {
      const res = await fetch(`/api/stories/${story.id}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((prev) => ({ ...prev, [story.id]: data.error || "Error confirming story." }));
        return;
      }
      await loadBacklog();
    } catch {
      setActionError((prev) => ({ ...prev, [story.id]: "Server error." }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectStory) return;
    setRejectLoading(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/stories/${rejectStory.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment: rejectComment || null }),
      });
      const data = await res.json();
      if (!res.ok) { setRejectError(data.error || "Error rejecting story."); return; }
      setRejectStory(null);
      setRejectComment("");
      await loadBacklog();
    } catch {
      setRejectError("Server error.");
    } finally {
      setRejectLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedIds.length || !activeSprint) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/backlog/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storyIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) { setAssignError(data.error || "Failed to assign stories."); return; }
      setSelectedIds([]);
      await loadBacklog();
    } catch {
      setAssignError("Server connection error.");
    } finally {
      setAssigning(false);
    }
  };

  const toggleSelect = (id: string) => {
    const story = unassigned.find((s) => s.id === id);
    if (!story || story.story_points == null) return;
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const canCreate = projectRole === "product_owner" || projectRole === "scrum_master";
  const canAssign = projectRole === "scrum_master";
  const isProductOwner = projectRole === "product_owner";

  // Check if today is the last day of the active sprint
  const today = new Date().toISOString().split("T")[0];
  const isLastDay = activeSprint?.end_date === today;
  // const isLastDay = true;

  const selectedPoints = selectedIds.reduce((sum, id) => {
    const story = unassigned.find((s) => s.id === id);
    return sum + (story?.story_points ?? 0);
  }, 0);
  const assignedPoints = assigned
  .filter((s) => !s.unfinished_sprint_info)
  .reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const remainingVelocity = activeSprint?.velocity != null ? activeSprint.velocity - assignedPoints : null;
  const exceedsVelocity = remainingVelocity != null && selectedPoints > remainingVelocity;

  const unassignedRegular = unassigned.filter((s) => s.priority !== "wont_have");
  const unassignedWontHave = unassigned.filter((s) => s.priority === "wont_have");

  // Split assigned into ready and in-progress/backlog
  const readyStories = assigned.filter((s) => s.status === "ready");
  const inSprintStories = assigned.filter((s) => s.status !== "ready");

  const sortedUnassigned = useSorted(unassignedRegular, sortBy);
  const sortedWontHave = useSorted(unassignedWontHave, sortBy);
  const sortedInSprint = useSorted(inSprintStories, sortBy);
  const sortedReady = useSorted(readyStories, sortBy);
  const sortedRealized = useSorted(realized, sortBy);

  const realizedSprints = [...new Set(
    realized
      .map((s) => (s as any).realized_sprint_info?.sprint_name)
      .filter(Boolean) as string[]
  )];

  const filteredRealized = filterSprints.size > 0
    ? sortedRealized.filter((s) => filterSprints.has((s as any).realized_sprint_info?.sprint_name))
    : sortedRealized;

  const currentList =
    activeTab === "unassigned" ? sortedUnassigned
    : activeTab === "assigned" ? sortedInSprint
    : activeTab === "ready" ? sortedReady
    : activeTab === "future" ? sortedWontHave
    : filteredRealized;

  const totalStories = realized.length + assigned.length + unassigned.length;

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    setSelectedIds([]);
    setAssignError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-subtle">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading backlog...</span>
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
            <h1 className="text-3xl font-bold text-foreground leading-tight">Product Backlog</h1>
            <BacklogHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {totalStories > 0 ? `${totalStories} stor${totalStories === 1 ? "y" : "ies"}` : "No stories yet"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canAssign && activeTab === "unassigned" && selectedIds.length > 0 && (
            <button
              onClick={handleAssign}
              disabled={assigning || !activeSprint || exceedsVelocity}
              title={!activeSprint ? "No active sprint" : exceedsVelocity ? `Exceeds sprint velocity (${selectedPoints}/${remainingVelocity} pts remaining)` : undefined}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors disabled:opacity-50 bg-accent-light border-accent-border text-accent-text hover:bg-accent/20"
            >
              {assigning ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              Add {selectedIds.length} to sprint
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
            >
              <span className="text-lg leading-none">+</span>
              New story
            </button>
          )}
        </div>
      </div>

      {/* Sprint banner */}
      {activeSprint ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-primary-border bg-primary-light mb-5 text-sm">
          <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-primary font-medium">Active sprint:</span>
          <span className="text-foreground">{activeSprint.name}</span>
          {isLastDay && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-error-light text-error border border-error-border">
              Last day
            </span>
          )}
          <span className="text-muted ml-auto text-xs flex items-center gap-3">
            {activeSprint.velocity != null && (
              <span>Velocity: <span className="text-foreground font-medium">{assignedPoints}/{activeSprint.velocity} pts</span></span>
            )}
            {formatDateDot(activeSprint.start_date)}
            {" – "}
            {formatDateDot(activeSprint.end_date)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-surface mb-5 text-sm text-muted">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          No active sprint — stories cannot be assigned until a sprint is active.
        </div>
      )}

      {(error || assignError) && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light mb-5">
          <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-error">{error || assignError}</p>
        </div>
      )}

      {/* Tabs + Sort */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border flex-wrap">
          <button onClick={() => switchTab("unassigned")} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "unassigned" ? "bg-primary-light text-primary border border-primary-border shadow-sm" : "text-muted hover:text-foreground"}`}>
            Unassigned
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === "unassigned" ? "bg-primary text-white" : "bg-border text-muted"}`}>{unassignedRegular.length}</span>
          </button>
          <button onClick={() => switchTab("assigned")} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "assigned" ? "bg-primary-light text-primary border border-primary-border shadow-sm" : "text-muted hover:text-foreground"}`}>
            In active sprint
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === "assigned" ? "bg-primary text-white" : "bg-border text-muted"}`}>{inSprintStories.length}</span>
          </button>
          <button onClick={() => switchTab("ready")} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "ready" ? "bg-primary-light text-primary border border-primary-border shadow-sm" : "text-muted hover:text-foreground"}`}>
            Ready for review
            {readyStories.length > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === "ready" ? "bg-primary text-white" : "bg-primary text-white"}`}>{readyStories.length}</span>}
            {readyStories.length === 0 && <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === "ready" ? "bg-primary text-white" : "bg-border text-muted"}`}>0</span>}
          </button>
          <button onClick={() => switchTab("realized")} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "realized" ? "bg-primary-light text-primary border border-primary-border shadow-sm" : "text-muted hover:text-foreground"}`}>
            Done
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === "realized" ? "bg-primary text-white" : "bg-border text-muted"}`}>{realized.length}</span>
          </button>
          <div className="flex items-center gap-1">
            <div className="w-px h-4 bg-border mx-1" />
            <button onClick={() => switchTab("future")} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "future" ? "bg-primary-light text-primary border border-primary-border shadow-sm" : "text-muted hover:text-foreground"}`}>
              Future Releases
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === "future" ? "bg-primary text-white" : "bg-border text-muted"}`}>{unassignedWontHave.length}</span>
            </button>
          </div>
        </div>

        {currentList.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-subtle">Sort by:</span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
              {SORT_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setSortBy(opt.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === opt.value ? "bg-primary-light text-primary border border-primary-border shadow-sm" : "text-muted hover:text-foreground"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ready for review info banner */}
      {activeTab === "ready" && isProductOwner && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-primary-border bg-primary-light mb-4 text-sm">
          <svg className="w-4 h-4 flex-shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-primary font-medium">You can confirm or reject stories below.</span>
        </div>
      )}

      {/* Select all row */}
      {activeTab === "unassigned" && unassignedRegular.length > 0 && canAssign && (
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={() => {
              const assignable = unassignedRegular.filter((s) => s.story_points != null).map((s) => s.id);
              setSelectedIds(selectedIds.length === assignable.length && selectedIds.length > 0 ? [] : assignable);
            }}
            className="text-xs text-primary hover:underline font-medium"
          >
            {selectedIds.length === unassignedRegular.filter((s) => s.story_points != null).length && selectedIds.length > 0 ? "Deselect all" : "Select all"}
          </button>
          {selectedIds.length > 0 && (
            <span className="text-xs text-muted flex items-center gap-2">
              {selectedIds.length} selected · {selectedPoints} pts
              {!activeSprint && <span className="text-error">— no active sprint</span>}
              {exceedsVelocity && <span className="text-error font-medium">— exceeds velocity ({selectedPoints}/{remainingVelocity} pts remaining)</span>}
            </span>
          )}
        </div>
      )}

      {/* Sprint filter for Done tab — multi-select dropdown */}
      {activeTab === "realized" && realizedSprints.length > 0 && (
        <SprintFilterDropdown
          sprints={realizedSprints}
          selected={filterSprints}
          onChange={setFilterSprints}
        />
      )}

      {/* Story list */}
      {currentList.length > 0 ? (
        <div className="space-y-2">
          {currentList.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              selectable={activeTab === "unassigned" && canAssign}
              selected={selectedIds.includes(story.id)}
              onToggle={() => toggleSelect(story.id)}
              onEdit={(s) => setEditingStory(s)}
              canEdit={
                (projectRole === "scrum_master" || projectRole === "product_owner") &&
                (activeTab === "unassigned" || activeTab === "future")
              }
              onComments={(s) => setCommentingStory(s)}
              canEstimate={
                projectRole === "scrum_master" &&
                (activeTab === "unassigned" || activeTab === "future")
              }
              onEstimateSubmit={(pts) => handleEstimate(story.id, pts)}
              canConfirmReject={activeTab === "ready" && isProductOwner}
              actionLoading={actionLoading}
              actionError={actionError[story.id]}
              onConfirm={() => handleConfirm(story)}
              onReject={() => { setRejectStory(story); setRejectComment(""); setRejectError(null); }}
              onPoker={() => handleStartPoker(story.id)}
              onJoinPoker={() => handleJoinPoker(activePokerSessions[story.id])}
              activeSessionId={activePokerSessions[story.id] ?? null}
              reviewSprintName={activeTab === "ready" ? (story.unfinished_sprint_info?.sprint_name ?? activeSprint?.name) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">
            {activeTab === "unassigned" ? "No unassigned stories"
              : activeTab === "assigned" ? "No stories in active sprint"
              : activeTab === "ready" ? "No stories ready for review"
              : activeTab === "future" ? "No future release stories"
              : "No completed stories yet"}
          </p>
          <p className="text-sm text-subtle">
            {activeTab === "unassigned" ? "All stories are assigned to a sprint or completed."
              : activeTab === "assigned" ? activeSprint ? "Add stories from the Unassigned tab." : "Start a sprint first."
              : activeTab === "ready" ? "Stories marked as ready by the team will appear here."
              : activeTab === "future" ? 'Stories with "Won\'t Have" priority will appear here.'
              : "Completed stories will appear here."}
          </p>
        </div>
      )}

      {/* Reject modal */}
      {rejectStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={() => !rejectLoading && setRejectStory(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
            <div className="h-1 w-full bg-gradient-to-r from-error to-error-border" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-error mb-0.5">Story</p>
                  <h3 className="text-lg font-bold text-foreground">Reject story</h3>
                </div>
                <button onClick={() => setRejectStory(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none bg-background hover:bg-border text-muted">×</button>
              </div>
              <p className="text-sm text-foreground mb-4">
                Rejecting <span className="font-semibold">{rejectStory.title}</span>. The story will be returned to the backlog.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-semibold tracking-widest uppercase text-primary mb-1">
                  Comment <span className="normal-case font-normal tracking-normal text-muted">(optional)</span>
                </label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  rows={3}
                  placeholder="Why is this story being rejected?"
                  className="mt-1 block w-full px-3 py-2.5 rounded-lg text-sm bg-background border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>
              {rejectError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-error-border bg-error-light mb-4">
                  <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-sm text-error">{rejectError}</p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setRejectStory(null)} disabled={rejectLoading} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted disabled:opacity-50">Cancel</button>
                <button onClick={handleRejectSubmit} disabled={rejectLoading} className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-error hover:bg-error/90">
                  {rejectLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Rejecting...
                    </span>
                  ) : "Reject story"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateStoryModal
        isOpen={isModalOpen}
        onClose={async () => { setIsModalOpen(false); await loadBacklog(); }}
        projectId={projectId}
      />

      {editingStory && (
        <EditStoryModal
          story={editingStory}
          onClose={() => setEditingStory(null)}
          onSaved={loadBacklog}
          projectRole={projectRole}
        />
      )}

      {commentingStory && (
        <CommentsModal
          storyId={commentingStory.id}
          storyTitle={commentingStory.title}
          isDone={commentingStory.status === "done"}
          onClose={() => setCommentingStory(null)}
        />
      )}
    </div>
  );
}