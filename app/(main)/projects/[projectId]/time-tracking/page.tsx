import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function TimeTrackingPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    notFound();
  }

  return (
    <div className="text-[var(--color-foreground)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          Time Tracking
        </h1>
        <p className="text-[var(--color-muted)]">
          Track time spent on tasks
        </p>
      </div>

      <div
        className="rounded-xl p-8 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p className="text-[var(--color-muted)]">
          No time entries yet.
        </p>
        <p className="text-sm text-[var(--color-subtle)]">
          Time is recorded on individual tasks.
        </p>
      </div>
    </div>
  );
}