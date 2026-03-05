import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function BoardPage({ params }: Props) {
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
        <h1 className="text-2xl font-bold text-gray-900">Sprint Board</h1>
        <p className="text-gray-600">Drag and drop tasks to update their status</p>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {["To Do", "In Progress", "Review", "Done"].map((column) => (
          <div key={column} className="bg-gray-100 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-4">{column}</h3>
            <div className="space-y-3">
              <p className="text-sm text-gray-500 italic">Ni taskov</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}