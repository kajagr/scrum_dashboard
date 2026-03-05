import type { Sprint } from "@/lib/types";

interface SprintCardProps {
  sprint: Sprint;
  onClick?: () => void;
}

const statusColors = {
  planned: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
};

const statusLabels = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

export default function SprintCard({ sprint, onClick }: SprintCardProps) {
  const startDate = new Date(sprint.start_date).toLocaleDateString("sl-SI");
  const endDate = new Date(sprint.end_date).toLocaleDateString("sl-SI");

  return (
    <div
      onClick={onClick}
      className={`p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
        <span className={`px-2 py-1 text-xs rounded ${statusColors[sprint.status]}`}>
          {statusLabels[sprint.status]}
        </span>
      </div>

      {sprint.goal && (
        <p className="text-sm text-gray-600 mb-3">{sprint.goal}</p>
      )}

      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>📅 {startDate} - {endDate}</span>
        {sprint.velocity && (
          <span>⚡ {sprint.velocity} pts</span>
        )}
      </div>
    </div>
  );
}