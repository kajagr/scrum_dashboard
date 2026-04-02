import type { Sprint } from "@/lib/types";

interface SprintCardProps {
  sprint: Sprint;
  onClick?: () => void;
  canEdit?: boolean;
  onEdit?: (sprint: Sprint) => void;
  onDelete?: (sprint: Sprint) => void;
}

const statusConfig = {
  planned: {
    label: "Planned",
    dot: "bg-accent",
    pill: "bg-accent-light text-accent-text border-accent-border",
  },
  active: {
    label: "Active",
    dot: "bg-primary",
    pill: "bg-primary-light text-primary border-primary-border",
  },
  completed: {
    label: "Completed",
    dot: "bg-subtle",
    pill: "bg-background text-muted border-border",
  },
};

export default function SprintCard({ sprint, onClick, canEdit, onEdit, onDelete }: SprintCardProps) {
  const startDate = new Date(sprint.start_date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
  const endDate = new Date(sprint.end_date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
  const durationDays = Math.ceil(
    (new Date(sprint.end_date).getTime() - new Date(sprint.start_date).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  const status = sprint.status ?? "planned";
  const cfg = statusConfig[status] ?? statusConfig.planned;

  const canModifyFull = canEdit && status === "planned";   // edit + delete
  const canModifyVelocity = canEdit && status === "active"; // edit only (velocity)

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl p-5 border transition-all duration-200
        bg-surface border-border
        hover:border-primary hover:shadow-md hover:shadow-primary/10
        ${onClick ? "cursor-pointer" : ""}`}
    >
      {/* Left accent line */}
      <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full transition-opacity opacity-50 group-hover:opacity-100 ${cfg.dot}`} />

      <div className="pl-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-foreground text-base leading-snug">
            {sprint.name}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${cfg.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>

            {/* Edit — shown for planned and active */}
            {(canModifyFull || canModifyVelocity) && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(sprint); }}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
                title={canModifyVelocity ? "Edit velocity" : "Edit sprint"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
            )}

            {/* Delete — only for planned */}
            {canModifyFull && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(sprint); }}
                className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error-light transition-colors"
                title="Delete sprint"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Goal */}
        {sprint.goal && (
          <p className="text-sm text-muted mb-3 leading-relaxed line-clamp-2">
            {sprint.goal}
          </p>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-xs text-subtle">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-muted">{startDate}</span>
            <span className="text-border">→</span>
            <span className="text-muted">{endDate}</span>
            <span className="text-border mx-1">·</span>
            <span>{durationDays} days</span>
          </div>

          {sprint.velocity && (
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 border bg-accent-light border-accent-border text-accent-text text-xs font-semibold">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              {sprint.velocity} pts
            </div>
          )}
        </div>
      </div>
    </div>
  );
}