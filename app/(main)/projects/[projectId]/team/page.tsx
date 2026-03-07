import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AddMemberButton from "@/components/features/users/AddMemberButton";

interface Props {
  params: Promise<{ projectId: string }>;
}

interface MemberWithUser {
  id: string;
  role: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export default async function TeamPage({ params }: Props) {
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

  const { data: members } = await supabase
    .from("project_members")
    .select(`
      *,
      user:users(*)
    `)
    .eq("project_id", projectId);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-600">Manage project members and roles</p>
        </div>
        <AddMemberButton />
      </div>

      {/* Team members */}
      <div className="bg-white rounded-lg border border-gray-200">
        {members && members.length > 0 ? (
          members.map((member: MemberWithUser) => (
            <div key={member.id} className="p-4 border-b border-gray-200 last:border-b-0 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-medium">
                  {member.user?.first_name?.[0]}{member.user?.last_name?.[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {member.user?.first_name} {member.user?.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{member.user?.email}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                member.role === "product_owner"
                  ? "bg-purple-100 text-purple-800"
                  : member.role === "scrum_master"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}>
                {member.role.replace("_", " ")}
              </span>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>Ni še članov.</p>
          </div>
        )}
      </div>
    </div>
  );
}