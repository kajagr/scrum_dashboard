import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function SettingsPage({ params }: Props) {
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
          Settings
        </h1>
        <p className="text-[var(--color-muted)]">
          Manage project settings
        </p>
      </div>

      <div
        className="max-w-xl rounded-xl p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 className="mb-4 font-semibold text-[var(--color-foreground)]">
          Project Details
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-muted)]">
              Name
            </label>
            <input
              type="text"
              defaultValue={project.name}
              disabled
              className="mt-1 w-full rounded-md px-3 py-2 text-sm"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-muted)]">
              Description
            </label>
            <textarea
              defaultValue={project.description || ""}
              disabled
              rows={3}
              className="mt-1 w-full rounded-md px-3 py-2 text-sm"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            />
          </div>
        </div>

        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Editing project settings will be available soon.
        </p>
      </div>
    </div>
  );
}