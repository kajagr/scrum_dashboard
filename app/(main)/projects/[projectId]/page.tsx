import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DashboardHelpTooltip from "@/components/features/dashboard/DashboardHelpTooltip";
import BurndownChart from "@/components/features/dashboard/BurndownChart";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDashboardPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !project) notFound();

  const { count: storiesCount } = await supabase
    .from("user_stories")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("deleted_at", null);

  const { count: doneStoriesCount } = await supabase
    .from("user_stories")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "done")
    .is("deleted_at", null);

  const { count: sprintsCount } = await supabase
    .from("sprints")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { count: membersCount } = await supabase
    .from("project_members")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("removed_at", null);

  const progressPct =
    storiesCount && storiesCount > 0
      ? Math.round(((doneStoriesCount ?? 0) / storiesCount) * 100)
      : 0;

  return (
    <div className="p-6 text-foreground">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Project
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            {project.name}
          </h1>
          <DashboardHelpTooltip />
        </div>
        <p className="text-sm text-muted mt-1">
          {project.description || "No description"}
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl p-5 border border-border bg-surface">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-2">
            User Stories
          </p>
          <p className="text-2xl font-bold text-foreground">
            {storiesCount ?? 0}
          </p>
          <p className="text-xs text-subtle mt-0.5">
            {doneStoriesCount ?? 0} completed
          </p>
        </div>
        <div className="rounded-xl p-5 border border-border bg-surface">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-2">
            Sprints
          </p>
          <p className="text-2xl font-bold text-foreground">
            {sprintsCount ?? 0}
          </p>
          <p className="text-xs text-subtle mt-0.5">total sprints</p>
        </div>
        <div className="rounded-xl p-5 border border-border bg-surface">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-2">
            Team
          </p>
          <p className="text-2xl font-bold text-foreground">
            {membersCount ?? 0}
          </p>
          <p className="text-xs text-subtle mt-0.5">members</p>
        </div>
        <div className="rounded-xl p-5 border border-border bg-surface">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-2">
            Progress
          </p>
          <p className="text-2xl font-bold text-primary">{progressPct}%</p>
          <div className="mt-2 w-full h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Burndown chart */}
      <BurndownChart projectId={projectId} />
    </div>
  );
}
