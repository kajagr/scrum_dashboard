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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
        <p className="text-gray-600">Track time spent on tasks</p>
      </div>

      <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
        <p>Ni še zabeleženih ur.</p>
        <p className="text-sm">Čas se beleži na posameznih taskih.</p>
      </div>
    </div>
  );
}