"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Confetti from "react-confetti";

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const CARD_VALUES = [...FIBONACCI, -1]; // -1 = "?"

type Member = {
  user_id: string;
  role: string;
  has_voted: boolean;
  estimate: number | null;
  is_absent: boolean;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
};

type Session = {
  id: string;
  user_story_id: string;
  project_id: string;
  status: string;
  current_round: number;
  final_estimate: number | null;
  completed_at: string | null;
  absent_member_ids: string[];
};

type Story = {
  id: string;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  status: string;
  priority: string;
  story_points: number | null;
};

type GameState = {
  session: Session;
  members: Member[];
  all_voted: boolean;
  suggested_estimate: number | null;
  my_vote: number | null;
  votes_history: { user_id: string; estimate: number; round_number: number }[];
};

export default function PokerPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const sessionId = params.sessionId as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalEstimateInput, setFinalEstimateInput] = useState<string>("");
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/poker/${sessionId}`, {
        credentials: "include",
      });

      if (!res.ok) return;

      const data: GameState = await res.json();
      setGameState(data);

      if (data.suggested_estimate !== null && finalEstimateInput === "") {
        setFinalEstimateInput(String(data.suggested_estimate));
      }
    } catch {
      /* ignore */
    }
  }, [sessionId, finalEstimateInput]);

  const fetchStory = useCallback(async (storyId: string) => {
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        credentials: "include",
      });

      if (res.ok) {
        setStory(await res.json());
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      try {
        const [stateRes, memberRes] = await Promise.all([
          fetch(`/api/poker/${sessionId}`, { credentials: "include" }),
          fetch(`/api/projects/${projectId}/members/me`, { credentials: "include" }),
        ]);

        if (stateRes.ok) {
          const data: GameState = await stateRes.json();
          setGameState(data);
          await fetchStory(data.session.user_story_id);

          if (data.suggested_estimate !== null) {
            setFinalEstimateInput(String(data.suggested_estimate));
          }
        }

        if (memberRes.ok) {
          const d = await memberRes.json();

          if (d.role) setMyRole(d.role);
          if (d.user_id) setMyUserId(d.user_id);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [sessionId, projectId, fetchStory]);

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchGameState();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchGameState]);

  const handleVote = async (estimate: number) => {
    if (voting || gameState?.my_vote !== null) return;

    setVoting(true);
    setError(null);

    try {
      const res = await fetch(`/api/poker/${sessionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estimate }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Voting error.");
        return;
      }

      await fetchGameState();
    } catch {
      setError("Error connecting to server.");
    } finally {
      setVoting(false);
    }
  };

  const handleNextRound = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/poker/${sessionId}/next-round`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error.");
        return;
      }

      setFinalEstimateInput("");
      setShowCompleteForm(false);
      setShowConfetti(false);

      await fetchGameState();
    } catch {
      setError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    const estimate = Number(finalEstimateInput);

    if (isNaN(estimate) || estimate < 0) {
      setError("Pick valid grade.");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/poker/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ final_estimate: estimate }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error.");
        return;
      }

      setShowConfetti(true);
      await fetchGameState();
      setShowCompleteForm(false);
    } catch {
      setError("Error connecting to server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAbsent = async (userId: string) => {
    if (!gameState) return;
    const current = gameState.session.absent_member_ids ?? [];
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];

    try {
      await fetch(`/api/poker/${sessionId}/absent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ absent_member_ids: updated }),
      });
      await fetchGameState();
    } catch {
      /* ignore */
    }
  };

  const isScrumMaster = myRole === "scrum_master";
  const myVote = gameState?.my_vote ?? null;
  const allVoted = gameState?.all_voted ?? false;
  const suggestedEstimate = gameState?.suggested_estimate ?? null;
  const isCompleted = gameState?.session.status === "completed";
  const currentRound = gameState?.session.current_round ?? 1;
  const finalEstimate = gameState?.session.final_estimate ?? null;

  const canNextRound =
    isScrumMaster && allVoted && currentRound < 3 && suggestedEstimate === null;
  const canComplete =
    isScrumMaster && allVoted && suggestedEstimate !== null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
        <span className="text-sm">Loading Planning Poker...</span>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="p-6 text-center text-muted">
        <p>Session does not exist or you do not have access.</p>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="p-6 relative min-h-[80vh] flex items-center justify-center">
        {showConfetti && (
          <div className="pointer-events-none fixed inset-0 z-50">
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              recycle={false}
              numberOfPieces={500}
              gravity={0.24}
              tweenDuration={9000}
              onConfettiComplete={() => setShowConfetti(false)}
            />
          </div>
        )}

        <div className="w-full max-w-2xl rounded-3xl border border-primary-border bg-surface shadow-xl p-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            Planning Poker Completed
          </p>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            Final Estimate
          </h1>

          <div className="mx-auto my-8 flex items-center justify-center">
            <div className="min-w-[220px] min-h-[220px] rounded-full border-4 border-primary bg-primary-light flex items-center justify-center shadow-lg">
              <span className="text-7xl md:text-8xl font-extrabold text-primary leading-none">
                {finalEstimate ?? "-"}
              </span>
            </div>
          </div>

          <p className="text-base text-muted mb-6">
            This story was completed with a final estimate of{" "}
            <span className="font-bold text-foreground">
              {finalEstimate ?? "-"} pts
            </span>
            .
          </p>

          {story && (
            <div className="mb-6 rounded-2xl border border-border bg-background p-4 text-left">
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-2">
                Story
              </p>
              <h2 className="text-lg font-bold text-foreground mb-1">
                {story.title}
              </h2>
              {story.description && (
                <p className="text-sm text-muted">{story.description}</p>
              )}
            </div>
          )}

          <button
            onClick={() => router.push(`/projects/${projectId}/product-backlog`)}
            className="px-6 py-3 text-sm font-semibold text-white rounded-xl bg-primary hover:bg-primary-hover transition-colors"
          >
            Back to backlog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50">
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={500}
            gravity={0.24}
            tweenDuration={9000}
            onConfettiComplete={() => setShowConfetti(false)}
          />
        </div>
      )}

      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Project
        </p>
        <h1 className="text-3xl font-bold text-foreground leading-tight">
          Planning Poker
        </h1>
        <p className="text-sm text-muted mt-1">
          Round {currentRound} / 3
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
            Participants
          </p>
          <div className="space-y-2">
            {gameState.members.map((member) => (
              <div
                key={member.user_id}
                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  member.is_absent
                    ? "bg-background/50 border-border opacity-60"
                    : "bg-background border-border"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      member.is_absent
                        ? "bg-muted/20 text-muted border-border"
                        : "bg-primary-light text-primary border-primary-border"
                    }`}
                  >
                    {member.user?.first_name?.[0]}
                    {member.user?.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {member.user?.first_name} {member.user?.last_name}
                      {member.user_id === myUserId && (
                        <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary-light border border-primary-border px-1.5 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted capitalize">
                      {member.role === "scrum_master" ? "Scrum Master" : "Team member"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {member.is_absent ? (
                    <span className="text-xs font-semibold text-muted bg-background border border-border px-2 py-0.5 rounded-full">
                      Absent
                    </span>
                  ) : allVoted && member.estimate !== null ? (
                    <span className="text-sm font-bold text-primary bg-primary-light border border-primary-border px-2.5 py-1 rounded-lg">
                      {member.estimate === -1 ? "?" : member.estimate}
                    </span>
                  ) : member.has_voted ? (
                    <span className="text-xs font-semibold text-[#34D399] bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.25)] px-2 py-0.5 rounded-full">
                      Voted
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-muted bg-background border border-border px-2 py-0.5 rounded-full">
                      Waiting
                    </span>
                  )}
                  {isScrumMaster && (
                    <button
                      onClick={() => handleToggleAbsent(member.user_id)}
                      title={member.is_absent ? "Mark present" : "Mark absent"}
                      className="text-muted hover:text-foreground transition-colors p-1 rounded"
                    >
                      {member.is_absent ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm8-4h6" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Voting
          </p>
          <p className="text-sm text-muted mb-4">
            {myVote !== null
              ? "You voted. Waiting for other members."
              : "Choose your estimate."}
          </p>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {CARD_VALUES.map((val) => {
              const isSelected = myVote === val;

              return (
                <button
                  key={val}
                  onClick={() => handleVote(val)}
                  disabled={myVote !== null || voting}
                  className={`
                    aspect-[2/3] rounded-xl border-2 text-lg font-bold transition-all
                    ${
                      isSelected
                        ? "border-primary bg-primary text-white shadow-lg scale-105"
                        : myVote !== null
                          ? "border-border bg-background text-muted opacity-50 cursor-not-allowed"
                          : "border-border bg-background text-foreground hover:border-primary hover:bg-primary-light hover:text-primary cursor-pointer"
                    }
                  `}
                >
                  {val === -1 ? "?" : val}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {myVote !== null && (
              <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border">
                <span className="text-xs text-muted">Your vote</span>
                <span className="text-sm font-bold text-primary">
                  {myVote === -1 ? "?" : myVote}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border">
              <span className="text-xs text-muted">Team progress</span>
              <span className="text-sm font-semibold text-foreground">
                {gameState.members.filter((m) => !m.is_absent && m.has_voted).length} /{" "}
                {gameState.members.filter((m) => !m.is_absent).length}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border">
              <span className="text-xs text-muted">Status</span>
              <span className="text-sm font-semibold text-foreground">
                {allVoted ? "All voted" : "Collecting votes"}
              </span>
            </div>
          </div>

          {canComplete && (
            <div className="mt-4 p-4 rounded-xl border border-primary-border bg-primary-light">
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-2">
                Suggested estimate
              </p>
              <p className="text-2xl font-bold text-foreground mb-3">
                {suggestedEstimate}
              </p>

              {isScrumMaster && (
                <>
                  {!showCompleteForm ? (
                    <button
                      onClick={() => setShowCompleteForm(true)}
                      className="w-full py-2 text-sm font-semibold text-white rounded-lg bg-primary hover:bg-primary-hover transition-colors"
                    >
                      Complete game →
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="number"
                        min="0"
                        value={finalEstimateInput}
                        onChange={(e) => setFinalEstimateInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        placeholder="Končna ocena"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowCompleteForm(false)}
                          className="flex-1 py-2 text-sm font-medium rounded-lg bg-background border border-border text-muted hover:bg-border transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleComplete}
                          disabled={actionLoading}
                          className="flex-1 py-2 text-sm font-semibold text-white rounded-lg bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                          {actionLoading ? "..." : "Confirm"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {canNextRound && (
            <div className="mt-4 p-4 rounded-xl border border-accent-border bg-accent-light">
              <p className="text-xs font-semibold tracking-widest uppercase text-accent-text mb-2">
                All voted
              </p>
              <p className="text-sm text-muted mb-3">
                Estimates differ. Start a new discussion round.
              </p>
              <button
                onClick={handleNextRound}
                disabled={actionLoading}
                className="w-full py-2 text-sm font-semibold text-white rounded-lg bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {actionLoading ? "..." : `Start round ${currentRound + 1} →`}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl border border-error-border bg-error-light">
              <svg
                className="w-4 h-4 text-error mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
            Story
          </p>

          {story ? (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-foreground">
                {story.title}
              </h2>

              {story.description && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
                    Description
                  </p>
                  <p className="text-sm text-foreground">{story.description}</p>
                </div>
              )}

              {story.acceptance_criteria && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
                    Acceptance Criteria
                  </p>
                  <p className="text-sm text-foreground">
                    {story.acceptance_criteria}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <div className="flex-1 p-2 rounded-lg bg-background border border-border">
                  <p className="text-xs text-muted mb-0.5">Status</p>
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {story.status}
                  </p>
                </div>

                <div className="flex-1 p-2 rounded-lg bg-background border border-border">
                  <p className="text-xs text-muted mb-0.5">Priority</p>
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {story.priority.replace("_", " ")}
                  </p>
                </div>
              </div>

              {story.story_points !== null && (
                <div className="p-2 rounded-lg bg-background border border-border">
                  <p className="text-xs text-muted mb-0.5">Current points</p>
                  <p className="text-sm font-semibold text-foreground">
                    {story.story_points} pts
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Loading story...</p>
          )}
        </div>
      </div>
    </div>
  );
}