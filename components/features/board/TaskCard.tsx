import type { Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  assigneeName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  unassigned:  { label: "Unassigned",  pill: "bg-background text-muted border border-border",               dot: "bg-subtle" },
  assigned:    { label: "Assigned",    pill: "bg-primary-light text-primary border border-primary-border",  dot: "bg-primary" },
  in_progress: { label: "In Progress", pill: "bg-accent-light text-accent-text border border-accent-border", dot: "bg-accent" },
  completed:   { label: "Done",        pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]", dot: "bg-[#34D399]" },
};

export default function TaskCard({ task, onClick, assigneeName }: TaskCardProps) {
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.unassigned;

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-3.5 rounded-xl border border-border bg-surface transition-all
        ${onClick ? "cursor-pointer hover:border-subtle hover:bg-background" : ""}`}
    >
      {/* Status dot */}
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.dot}`} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.status === "completed" ? "line-through text-muted" : "text-foreground"}`}>
          {task.title}
        </p>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.pill}`}>
            {statusCfg.label}
          </span>

          {task.estimated_hours != null && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
              </svg>
              {task.logged_hours ?? 0}h / {task.estimated_hours}h
            </span>
          )}

          {assigneeName && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <span className="w-4 h-4 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-[8px] font-bold">
                {assigneeName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </span>
              {assigneeName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}