"use client";

type WallPost = {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

interface WallSidebarProps {
  posts: WallPost[];
}

function Avatar({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span className="w-7 h-7 text-[10px] rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center font-bold flex-shrink-0">
      {initials}
    </span>
  );
}

export default function WallSidebar({ posts }: WallSidebarProps) {
  const contributors = posts.reduce<WallPost["author"][]>((acc, post) => {
    if (post.author && !acc.find((a) => a?.id === post.author?.id)) acc.push(post.author);
    return acc;
  }, []);

  return (
    <div className="w-64 flex-shrink-0 space-y-4 sticky top-6">
      {/* Stats */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Activity</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background border border-border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{posts.length}</p>
            <p className="text-xs text-muted mt-0.5">Posts</p>
          </div>
          <div className="rounded-xl bg-background border border-border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{contributors.length}</p>
            <p className="text-xs text-muted mt-0.5">Contributors</p>
          </div>
        </div>
      </div>

      {/* Contributors */}
      {contributors.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Contributors</p>
          <div className="space-y-2.5">
            {contributors.map((author) => (
              <div key={author?.id} className="flex items-center gap-2.5">
                <Avatar firstName={author?.first_name} lastName={author?.last_name} />
                <span className="text-sm text-foreground truncate flex-1">
                  {author?.first_name} {author?.last_name}
                </span>
                <span className="text-xs text-muted font-medium">
                  {posts.filter((p) => p.author?.id === author?.id).length}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}