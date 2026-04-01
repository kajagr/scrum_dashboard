"use client";

type WallPostCardProps = {
  author: { id: string; first_name: string; last_name: string } | null;
  content: string;
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span className="w-7 h-7 text-[10px] rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center font-bold flex-shrink-0">
      {initials}
    </span>
  );
}

export default function WallPostCard({ author, content, created_at }: WallPostCardProps) {
  return (
    <div className="flex gap-5">
      {/* Timeline dot */}
      <div className="relative flex-shrink-0 mt-4">
        <div className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20" />
      </div>
      {/* Card */}
      <div className="flex-1 rounded-2xl border border-border bg-surface hover:border-subtle transition-colors p-4">
        <div className="flex items-center gap-2.5 mb-2.5">
          <Avatar firstName={author?.first_name} lastName={author?.last_name} />
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {author ? `${author.first_name} ${author.last_name}` : "Unknown"}
            </p>
            <p className="text-xs text-muted">{timeAgo(created_at)}</p>
          </div>
        </div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      </div>
    </div>
  );
}