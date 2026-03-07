"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navigation = [
  { name: "Dashboard", href: "", icon: "📊" },
  { name: "Backlog", href: "/backlog", icon: "📝" },
  { name: "Sprint Board", href: "/board", icon: "📋" },
  { name: "Sprints", href: "/sprints", icon: "🏃" },
  { name: "Time Tracking", href: "/time-tracking", icon: "⏱️" },
  { name: "Team", href: "/team", icon: "👥" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const projectId = params.projectId as string;

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("system_role")
        .eq("id", user.id)
        .single();

      setIsAdmin(data?.system_role === "admin");
    };

    checkAdmin();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Project title */}
      <div className="p-4 border-b border-gray-200">
        <Link
          href="/projects"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          ← Vsi projekti
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const href = `/projects/${projectId}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === `/projects/${projectId}`
              : pathname.startsWith(href);

          return (
            <Link
              key={item.name}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{item.icon}</span>
              {item.name}
            </Link>
          );
        })}

        {/* Admin only */}
        {isAdmin && (
          <>
            <div className="border-t border-gray-200 my-3"></div>
            <Link
              href="/users"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/users"
                  ? "bg-purple-50 text-purple-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>👤</span>
              Uporabniki
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
        >
          🚪 Odjava
        </button>
      </div>
    </aside>
  );
}