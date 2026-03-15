import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

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

  if (error || !project) {
    notFound();
  }

  const { count: storiesCount } = await supabase
    .from("user_stories")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { count: sprintsCount } = await supabase
    .from("sprints")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  return (
    <div className="p-6 text-foreground">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
        <h1 className="text-3xl font-bold text-foreground leading-tight">{project.name}</h1>
        <p className="text-sm text-muted mt-1">{project.description || "No description"}</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="mb-1 text-sm text-[var(--color-muted)]">
            User Stories
          </div>
          <div className="text-2xl font-bold text-[var(--color-foreground)]">
            {storiesCount || 0}
          </div>
        </div>

        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="mb-1 text-sm text-[var(--color-muted)]">
            Sprints
          </div>
          <div className="text-2xl font-bold text-[var(--color-foreground)]">
            {sprintsCount || 0}
          </div>
        </div>

        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="mb-1 text-sm text-[var(--color-muted)]">
            Team Members
          </div>
          <div className="text-2xl font-bold text-[var(--color-foreground)]">
            -
          </div>
        </div>

        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="mb-1 text-sm text-[var(--color-muted)]">
            Progress
          </div>
          <div className="text-2xl font-bold text-[var(--color-foreground)]">
            -
          </div>
        </div>
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        This is the project dashboard. You can add more statistics and charts here.
      </p>
    </div>
  );
}