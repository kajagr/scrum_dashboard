import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SettingsHelpTooltip from "@/components/features/settings/SettingsHelpTooltip";

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
    <div className="p-6 text-foreground">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Project
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            Settings
          </h1>
          <SettingsHelpTooltip />
        </div>
        <p className="text-sm text-muted mt-1">Manage project settings</p>
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