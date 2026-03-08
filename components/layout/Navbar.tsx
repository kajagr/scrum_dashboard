import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="h-16 bg-surface border-b border-border px-6 flex items-center justify-between">
      <Link href="/projects" className="text-xl font-bold text-foreground">
        ScrumBoard
      </Link>
      <div className="text-sm text-muted">
        {new Date().toLocaleDateString("sl-SI", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    </nav>
  );
}
