import type { Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  assigneeName?: string;
}

const statusColors = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
};

export default function TaskCard({ task, onClick, assigneeName }: TaskCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
    >
      <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>

      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex justify-between items-center">
        <span className={`px-2 py-1 text-xs rounded ${statusColors[task.status]}`}>
          {task.status.replace("_", " ")}
        </span>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {task.estimated_hours && (
            <span>⏱️ {task.logged_hours || 0}h / {task.estimated_hours}h</span>
          )}
          {assigneeName && (
            <span>👤 {assigneeName}</span>
          )}
        </div>
      </div>
    </div>
  );
}