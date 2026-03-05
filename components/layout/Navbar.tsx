import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <Link href="/projects" className="text-xl font-bold text-gray-900">
        ScrumBoard
      </Link>
      <div className="text-sm text-gray-500">
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