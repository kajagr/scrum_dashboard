"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  KanbanSquare,
  Timer,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

const navigation = [
  { name: "Projects", type: "global", href: "/projects", icon: FolderKanban },
  { name: "Dashboard", type: "project", href: "" as const, icon: LayoutDashboard },
  
  { name: "Backlog", type: "project", href: "/backlog", icon: ClipboardList },
  { name: "Sprint Board", type: "project", href: "/board", icon: KanbanSquare },
  { name: "Time Tracking", type: "project", href: "/time-tracking", icon: Timer },
  { name: "Team", type: "project", href: "/team", icon: Users },
  { name: "Settings", type: "project", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const projectId = params?.projectId as string | undefined;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="flex w-72 flex-col border-r border-gray-200 bg-gradient-to-b from-slate-100 via-blue-50 to-slate-200 shadow-xl">
      {/* Logo / brand */}
     

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;

            let href = "#";
            let isDisabled = false;
            let isActive = false;

            if (item.type === "global") {
              href = item.href;
              isActive = pathname === href;
            }

            if (item.type === "project") {
              if (!projectId) {
                isDisabled = true;
              } else {
                href = `/projects/${projectId}${item.href}`;
                isActive =
                  item.href === ""
                    ? pathname === `/projects/${projectId}`
                    : pathname.startsWith(href);
              }
            }

            if (isDisabled) {
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-400 cursor-not-allowed"
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={href}
                className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-700 hover:bg-white/60 hover:text-gray-900"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-blue-600"></span>
                )}

                <Icon
                  size={18}
                  className={isActive ? "text-blue-700" : "text-gray-500 group-hover:text-gray-700"}
                />

                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut size={18} className="text-gray-500" />
          <span>Odjava</span>
        </button>
      </div>
    </aside>
  );
}