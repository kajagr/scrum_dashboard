"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Player = {
  id: string;
  name: string;
  avatar: string;
  role?: string;
  hasVoted: boolean;
  selectedCard?: string;
  isCurrentUser?: boolean;
};

type Story = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  status: string;
  priority: string;
};

const CARD_VALUES = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?"];

const MOCK_PLAYERS: Player[] = [
  {
    id: "1",
    name: "Sara",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    role: "Developer",
    hasVoted: false,
  },
  {
    id: "2",
    name: "Nina",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    role: "Developer",
    hasVoted: true,
    selectedCard: "5",
  },
  {
    id: "3",
    name: "Tim",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    role: "Developer",
    hasVoted: false,
  },
  {
    id: "4",
    name: "Luka",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    role: "Developer",
    hasVoted: true,
    selectedCard: "8",
  },
  {
    id: "5",
    name: "David",
    avatar:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=80",
    role: "Scrum master",
    hasVoted: true,
    selectedCard: "3",
    isCurrentUser: true,
  },
];

const MOCK_STORY: Story = {
  id: "story-1",
  title: "Add CTA to onboarding page",
  description:
    "As a visitor, I want to clearly see the primary call to action on the onboarding page, so that I know what the next step is immediately after landing on the page.",
  acceptanceCriteria: [
    "CTA button is visible above the fold.",
    "Button label is clear and action-oriented.",
    "Component is responsive on mobile and desktop.",
  ],
  status: "In Progress",
  priority: "High",
};

function VotingCard({
  value,
  selected,
  onClick,
}: {
  value: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-24 w-14 rounded-xl border text-2xl font-bold transition-all duration-200 sm:h-28 sm:w-16",
        selected
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-border bg-surface text-primary hover:border-primary hover:-translate-y-0.5 hover:shadow-sm",
      ].join(" ")}
    >
      {value}
    </button>
  );
}

function ParticipantList({
  players,
  revealVotes,
}: {
  players: Player[];
  revealVotes: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
          Team
        </p>
        <h2 className="text-lg font-bold text-foreground">Participants</h2>
        <p className="text-sm text-subtle mt-1">
          Live voting overview for the current round.
        </p>
      </div>

      <div className="space-y-3">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={player.avatar}
                alt={player.name}
                className="h-10 w-10 rounded-full object-cover shadow-sm"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {player.name}
                  </p>
                  {player.isCurrentUser && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      You
                    </span>
                  )}
                </div>
                <p className="text-xs text-subtle">{player.role ?? "Team member"}</p>
              </div>
            </div>

            <div className="shrink-0">
              {!player.hasVoted ? (
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-subtle">
                  Waiting
                </span>
              ) : revealVotes ? (
                <span className="rounded-full border border-primary bg-primary text-white px-2.5 py-1 text-xs font-semibold">
                  {player.selectedCard ?? "?"}
                </span>
              ) : (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  Voted
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StoryDetailsPanel({ story }: { story: Story }) {
  return (
    <aside className="xl:sticky xl:top-6">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
          Story
        </p>

        <h2 className="text-xl font-bold text-foreground">{story.title}</h2>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Description
            </p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              {story.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Acceptance criteria
            </p>
            <div className="mt-2 space-y-2">
              {story.acceptanceCriteria.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {story.status}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Priority
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {story.priority}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function PlanningPokerPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [selectedCard, setSelectedCard] = useState<string>("3");
  const [revealVotes, setRevealVotes] = useState(false);

  const players = useMemo(
    () =>
      MOCK_PLAYERS.map((player) =>
        player.isCurrentUser
          ? {
              ...player,
              selectedCard,
              hasVoted: Boolean(selectedCard),
            }
          : player,
      ),
    [selectedCard],
  );

  const voteCount = useMemo(
    () => players.filter((player) => player.hasVoted).length,
    [players],
  );

  const allVoted = voteCount === players.length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Project
          </p>
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            Planning Poker
          </h1>
          <p className="text-sm text-muted mt-1">
            Death Star Team · Estimation round
          </p>
          <p className="text-xs text-subtle mt-1">Project ID: {projectId}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-border bg-surface px-4 py-2 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Progress
            </p>
            <p className="text-sm font-semibold text-foreground">
              {voteCount}/{players.length} voted
            </p>
          </div>

          <button
            onClick={() => setRevealVotes((current) => !current)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover"
          >
            {revealVotes ? "Hide votes" : "Reveal votes"}
          </button>

          <button
            onClick={() => {
              setRevealVotes(false);
              setSelectedCard("");
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors shadow-sm border border-border bg-surface text-foreground hover:bg-background"
          >
            Reset round
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* Left */}
        <ParticipantList players={players} revealVotes={revealVotes} />

        {/* Center */}
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6 lg:p-8">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
              Voting
            </p>
            <h2 className="text-2xl font-bold text-foreground">
              Choose your estimate
            </h2>
            <p className="mt-2 text-sm text-subtle">
              Select one card for the current story. Your vote stays hidden until reveal.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {CARD_VALUES.map((value) => (
                <VotingCard
                  key={value}
                  value={value}
                  selected={selectedCard === value}
                  onClick={() => setSelectedCard(value)}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Your vote
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {selectedCard || "Not selected"}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Team progress
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {voteCount}/{players.length}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Round state
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {revealVotes ? "Revealed" : allVoted ? "Ready to reveal" : "Collecting votes"}
              </p>
            </div>
          </div>
        </section>

        {/* Right */}
        <StoryDetailsPanel story={MOCK_STORY} />
      </div>
    </div>
  );
}