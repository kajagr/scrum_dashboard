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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage project settings</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 max-w-xl">
        <h2 className="font-semibold text-gray-900 mb-4">Project Details</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              defaultValue={project.name}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              defaultValue={project.description || ""}
              disabled
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Urejanje nastavitev bo omogočeno kmalu.
        </p>
      </div>
    </div>
  );
}