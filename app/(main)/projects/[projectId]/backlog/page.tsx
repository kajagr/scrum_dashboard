"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CreateStoryModal from "@/components/features/stories/CreateStoryModal";
import BacklogHelpTooltip from "@/components/features/stories/BacklogHelpTooltip";
import type { UserStory } from "@/lib/types";

type SortKey = "created_at" | "business_value" | "priority";
type TabKey = "unassigned" | "assigned" | "realized";

const PRIORITY_ORDER: Record<string, number> = {
  must_have: 0, should_have: 1, could_have: 2, wont_have: 3,
};

const PRIORITY_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  must_have:   { label: "Must Have",   pill: "bg-error-light text-error border border-error-border",         dot: "bg-error" },
  should_have: { label: "Should Have", pill: "bg-accent-light text-accent-text border border-accent-border", dot: "bg-accent" },
  could_have:  { label: "Could Have",  pill: "bg-primary-light text-primary border border-primary-border",   dot: "bg-primary" },
  wont_have:   { label: "Won't Have",  pill: "bg-background text-muted border border-border",                dot: "bg-subtle" },
};

const STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  backlog:     { label: "Backlog",     pill: "bg-background text-muted border border-border" },
  ready:       { label: "Ready",       pill: "bg-primary-light text-primary border border-primary-border" },
  in_progress: { label: "In Progress", pill: "bg-accent-light text-accent-text border border-accent-border" },
  done:        { label: "Done",        pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]" },
};

type SprintInfo = { id: string; name: string; start_date: string; end_date: string; velocity: number | null; };
type BacklogResponse = { activeSprint: SprintInfo | null; realized: UserStory[]; assigned: UserStory[]; unassigned: UserStory[]; };

// ── Story Card ────────────────────────────────────────────────────────────────
function StoryCard({ story, selectable, selected, onToggle }: {
  story: UserStory;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.wont_have;
  const status   = STATUS_CONFIG[story.status]     ?? STATUS_CONFIG.backlog;
  const missingPoints = selectable && (story.story_points == null);
  const clickable = selectable && !missingPoints;
  return (
    <div
      onClick={clickable ? onToggle : undefined}
      title={missingPoints ? "Story points must be set before assigning to a sprint" : undefined}
      className={`flex items-start gap-3 p-4 rounded-xl border transition-all
        ${clickable ? "cursor-pointer" : ""}
        ${missingPoints ? "opacity-50 cursor-not-allowed" : ""}
        ${selected ? "bg-primary-light border-primary-border shadow-sm" : "bg-background border-border hover:border-subtle"}`}
    >
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
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {story.business_value != null && (
              <span className="text-xs text-muted bg-surface border border-border px-2 py-0.5 rounded-lg">BV {story.business_value}</span>
            )}
            {story.story_points != null ? (
              <span className="text-xs text-muted bg-surface border border-border px-2 py-0.5 rounded-lg">{story.story_points} pts</span>
            ) : selectable ? (
              <span className="text-xs text-error bg-error-light border border-error-border px-2 py-0.5 rounded-lg">No SP</span>
            ) : null}
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
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created_at",     label: "Date" },
  { value: "business_value", label: "Business value" },
  { value: "priority",       label: "Priority" },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: "unassigned", label: "Unassigned" },
  { key: "assigned",   label: "In active sprint" },
  { key: "realized",   label: "Done" },
];

function useSorted(stories: UserStory[], sortBy: SortKey) {
  return useMemo(() => [...stories].sort((a, b) => {
    if (sortBy === "created_at")     return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === "business_value") return (b.business_value ?? 0) - (a.business_value ?? 0);
    if (sortBy === "priority")       return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    return 0;
  }), [stories, sortBy]);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BacklogPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [activeSprint, setActiveSprint] = useState<SprintInfo | null>(null);
  const [realized, setRealized]       = useState<UserStory[]>([]);
  const [assigned, setAssigned]       = useState<UserStory[]>([]);
  const [unassigned, setUnassigned]   = useState<UserStory[]>([]);
  const [activeTab, setActiveTab]     = useState<TabKey>("unassigned");
  const [sortBy, setSortBy]           = useState<SortKey>("created_at");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigning, setAssigning]     = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectRole, setProjectRole] = useState<string | null>(null);

  const loadBacklog = async () => {
    try {
      setLoading(true);
      setError(null);
      const [backlogRes, memberRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/backlog`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/members/me`, { credentials: "include" }),
      ]);
      if (!backlogRes.ok) {
        const d = await backlogRes.json();
        setError(d.error || "Failed to load backlog.");
        return;
      }
      const data: BacklogResponse = await backlogRes.json();
      setActiveSprint(data.activeSprint ?? null);
      setRealized(data.realized ?? []);
      setAssigned(data.assigned ?? []);
      setUnassigned(data.unassigned ?? []);
      if (memberRes.ok) {
        const me = await memberRes.json();
        setProjectRole(me.role ?? null);
      }
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBacklog(); }, [projectId]);

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

  // If role fetch failed (null), show buttons — server will enforce permissions
  const canCreate = projectRole !== "developer";
  const canAssign = projectRole !== "developer";

  const selectedPoints = selectedIds.reduce((sum, id) => {
    const story = unassigned.find((s) => s.id === id);
    return sum + (story?.story_points ?? 0);
  }, 0);
  const assignedPoints = assigned.reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const remainingVelocity = activeSprint?.velocity != null
    ? activeSprint.velocity - assignedPoints
    : null;
  const exceedsVelocity = remainingVelocity != null && selectedPoints > remainingVelocity;

  const sortedUnassigned = useSorted(unassigned, sortBy);
  const sortedAssigned   = useSorted(assigned,   sortBy);
  const sortedRealized   = useSorted(realized,   sortBy);
  const currentList = activeTab === "unassigned" ? sortedUnassigned : activeTab === "assigned" ? sortedAssigned : sortedRealized;
  const totalStories = realized.length + assigned.length + unassigned.length;

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
          <span className="text-muted ml-auto text-xs flex items-center gap-3">
            {activeSprint.velocity != null && (
              <span>
                Velocity: <span className="text-foreground font-medium">{assignedPoints}/{activeSprint.velocity} pts</span>
              </span>
            )}
            {new Date(activeSprint.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {" – "}
            {new Date(activeSprint.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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

      {/* Error */}
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
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
          {TABS.map((tab) => {
            const count = tab.key === "unassigned" ? unassigned.length : tab.key === "assigned" ? assigned.length : realized.length;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedIds([]); setAssignError(null); }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-primary-light text-primary border border-primary-border shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  activeTab === tab.key ? "bg-primary text-white" : "bg-border text-muted"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {currentList.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-subtle">Sort by:</span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === opt.value
                      ? "bg-primary-light text-primary border border-primary-border shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Select all row */}
      {activeTab === "unassigned" && unassigned.length > 0 && canAssign && (
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={() => { const assignable = unassigned.filter((s) => s.story_points != null).map((s) => s.id); setSelectedIds(selectedIds.length === assignable.length ? [] : assignable); }}
            className="text-xs text-primary hover:underline font-medium"
          >
            {selectedIds.length === unassigned.length ? "Deselect all" : "Select all"}
          </button>
          {selectedIds.length > 0 && (
            <span className="text-xs text-muted flex items-center gap-2">
              {selectedIds.length} selected · {selectedPoints} pts
              {!activeSprint && <span className="text-error">— no active sprint</span>}
              {exceedsVelocity && (
                <span className="text-error font-medium">
                  — exceeds velocity ({selectedPoints}/{remainingVelocity} pts remaining)
                </span>
              )}
            </span>
          )}
        </div>
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
              : "No completed stories yet"}
          </p>
          <p className="text-sm text-subtle">
            {activeTab === "unassigned" ? "All stories are assigned to a sprint or completed."
              : activeTab === "assigned" ? (activeSprint ? "Add stories from the Unassigned tab." : "Start a sprint first.")
              : "Completed stories will appear here."}
          </p>
        </div>
      )}

      <CreateStoryModal
        isOpen={isModalOpen}
        onClose={async () => { setIsModalOpen(false); await loadBacklog(); }}
        projectId={projectId}
      />
    </div>
  );
}