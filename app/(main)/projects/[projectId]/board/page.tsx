import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ projectId: string }>;
}

type Story = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  story_points: number | null;
  business_value: number | null;
  sprint_id: string | null;
};

type Sprint = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  velocity: number | null;
};

const PRIORITY_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  must_have:   { label: "Must Have",   pill: "bg-[rgba(252,129,129,0.1)] text-[#FC8181] border border-[rgba(252,129,129,0.25)]",   dot: "bg-[#FC8181]" },
  should_have: { label: "Should Have", pill: "bg-[rgba(139,92,246,0.12)] text-[#A78BFA] border border-[rgba(139,92,246,0.25)]",   dot: "bg-[#8B5CF6]" },
  could_have:  { label: "Could Have",  pill: "bg-[rgba(91,141,239,0.12)] text-[#5B8DEF] border border-[rgba(91,141,239,0.25)]",   dot: "bg-[#5B8DEF]" },
  wont_have:   { label: "Won't Have",  pill: "bg-[rgba(107,122,153,0.12)] text-[#6B7A99] border border-[rgba(107,122,153,0.25)]", dot: "bg-[#6B7A99]" },
};

const STATUS_CONFIG: Record<string, { label: string; pill: string; order: number }> = {
  backlog:     { label: "Backlog",     pill: "bg-[rgba(107,122,153,0.12)] text-[#6B7A99] border border-[rgba(107,122,153,0.25)]", order: 0 },
  ready:       { label: "Ready",       pill: "bg-[rgba(91,141,239,0.12)] text-[#5B8DEF] border border-[rgba(91,141,239,0.25)]",   order: 1 },
  in_progress: { label: "In Progress", pill: "bg-[rgba(139,92,246,0.12)] text-[#A78BFA] border border-[rgba(139,92,246,0.25)]",   order: 2 },
  done:        { label: "Done",        pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]",   order: 3 },
};

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export default async function SprintBoardPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const today = getTodayDateString();

  // Active sprint
  const { data: activeSprint } = await supabase
    .from("sprints")
    .select("id, name, start_date, end_date, status, velocity")
    .eq("project_id", projectId)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle() as { data: Sprint | null };

  // Stories in active sprint
  const stories: Story[] = [];
  if (activeSprint) {
    const { data } = await supabase
      .from("user_stories")
      .select("id, title, description, priority, status, story_points, business_value, sprint_id")
      .eq("project_id", projectId)
      .eq("sprint_id", activeSprint.id)
      .order("status", { ascending: true });
    if (data) stories.push(...data);
  }

  // Sort by status order, then priority
  const PRIORITY_ORDER: Record<string, number> = { must_have: 0, should_have: 1, could_have: 2, wont_have: 3 };
  const sorted = [...stories].sort((a, b) => {
    const statusDiff = (STATUS_CONFIG[a.status]?.order ?? 99) - (STATUS_CONFIG[b.status]?.order ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
  });

  const totalPoints = stories.reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const donePoints  = stories.filter((s) => s.status === "done").reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const doneCount   = stories.filter((s) => s.status === "done").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#5B8DEF] mb-1">Project</p>
        <h1 className="text-3xl font-bold text-[var(--color-foreground,#E8EDF5)] leading-tight">Sprint Board</h1>
      </div>

      {activeSprint ? (
        <>
          {/* Sprint info bar */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-[rgba(91,141,239,0.25)] bg-[rgba(91,141,239,0.08)] mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-semibold text-[var(--color-foreground,#E8EDF5)]">{activeSprint.name}</span>
            </div>
            <span className="text-xs text-[#6B7A99]">
              {new Date(activeSprint.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" – "}
              {new Date(activeSprint.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <div className="ml-auto flex items-center gap-4 text-xs text-[#6B7A99]">
              <span><span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{doneCount}/{stories.length}</span> stories done</span>
              <span><span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{donePoints}/{totalPoints}</span> pts completed</span>
              {activeSprint.velocity && (
                <span>Velocity: <span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{activeSprint.velocity}</span></span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalPoints > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-[#6B7A99] mb-1.5">
                <span>Progress</span>
                <span>{Math.round((donePoints / totalPoints) * 100)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#2D3748] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#34D399] transition-all"
                  style={{ width: `${Math.round((donePoints / totalPoints) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Story list */}
          {sorted.length > 0 ? (
            <div className="space-y-2">
              {sorted.map((story, i) => {
                const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.wont_have;
                const status   = STATUS_CONFIG[story.status]     ?? STATUS_CONFIG.backlog;
                const prevStatus = i > 0 ? sorted[i - 1].status : null;
                const showDivider = i > 0 && story.status !== prevStatus;

                return (
                  <div key={story.id}>
                    {showDivider && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-px flex-1 bg-[#2D3748]" />
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.pill}`}>
                          {status.label}
                        </span>
                        <div className="h-px flex-1 bg-[#2D3748]" />
                      </div>
                    )}

                    <div className="flex items-start gap-3 p-4 rounded-xl border border-[#2D3748] bg-[#1C2333] hover:border-[#4A5568] transition-colors">
                      {/* Position number */}
                      <span className="text-xs text-[#6B7A99] font-mono mt-0.5 w-5 text-right flex-shrink-0">{i + 1}</span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-[var(--color-foreground,#E8EDF5)] leading-snug">{story.title}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {story.business_value != null && (
                              <span className="text-xs text-[#6B7A99] bg-[#151C2B] border border-[#2D3748] px-2 py-0.5 rounded-lg">
                                BV {story.business_value}
                              </span>
                            )}
                            {story.story_points != null && (
                              <span className="text-xs text-[#6B7A99] bg-[#151C2B] border border-[#2D3748] px-2 py-0.5 rounded-lg">
                                {story.story_points} pts
                              </span>
                            )}
                          </div>
                        </div>

                        {story.description && (
                          <p className="text-xs text-[#6B7A99] mb-2.5 line-clamp-2">{story.description}</p>
                        )}

                        <div className="flex items-center gap-1.5">
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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl border border-[#2D3748] bg-[#1C2333] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="font-semibold text-[var(--color-foreground,#E8EDF5)] mb-1">No stories in this sprint</p>
              <p className="text-sm text-[#6B7A99]">Add stories from the Product Backlog.</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-[#2D3748] bg-[#1C2333] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-semibold text-[var(--color-foreground,#E8EDF5)] mb-1">No active sprint</p>
          <p className="text-sm text-[#6B7A99]">Start a sprint from the Sprints page to see stories here.</p>
        </div>
      )}
    </div>
  );
}