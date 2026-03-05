import type { UserStory } from "@/lib/types";

interface StoryCardProps {
  story: UserStory;
  onClick?: () => void;
}

const priorityColors = {
  must_have: "bg-red-100 text-red-800",
  should_have: "bg-yellow-100 text-yellow-800",
  could_have: "bg-blue-100 text-blue-800",
  wont_have: "bg-gray-100 text-gray-800",
};

const priorityLabels = {
  must_have: "Must Have",
  should_have: "Should Have",
  could_have: "Could Have",
  wont_have: "Won't Have",
};

const statusColors = {
  backlog: "bg-gray-100 text-gray-800",
  ready: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
};

export default function StoryCard({ story, onClick }: StoryCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900">{story.title}</h3>
        <span className="px-2 py-1 text-xs bg-gray-100 rounded font-medium">
          {story.story_points || "-"} pts
        </span>
      </div>

      {story.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {story.description}
        </p>
      )}

      <div className="flex gap-2">
        <span className={`px-2 py-1 text-xs rounded ${priorityColors[story.priority]}`}>
          {priorityLabels[story.priority]}
        </span>
        <span className={`px-2 py-1 text-xs rounded ${statusColors[story.status]}`}>
          {story.status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}