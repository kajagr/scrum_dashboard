"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  Flag,
  UserPlus,
} from "lucide-react";

const navigation = [
  { name: "Projects", type: "global", href: "/projects", icon: FolderKanban },
  {
    name: "Dashboard",
    type: "project",
    href: "" as const,
    icon: LayoutDashboard,
  },
  { name: "Product Backlog", type: "project", href: "/backlog", icon: ClipboardList },
  { name: "Sprint Board", type: "project", href: "/board", icon: KanbanSquare },
  { name: "Sprints", type: "project", href: "/sprints", icon: Flag },
  {
    name: "Time Tracking",
    type: "project",
    href: "/time-tracking",
    icon: Timer,
  },
  { name: "Team", type: "project", href: "/team", icon: Users },
  { name: "Settings", type: "project", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const projectId = params?.projectId as string | undefined;
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    <aside className="flex w-64 flex-col bg-surface border-r border-border">
      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-subtle cursor-not-allowed opacity-40"
              >
                <Icon size={17} />
                <span>{item.name}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-primary-light text-primary"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
              )}
              <Icon
                size={17}
                className={
                  isActive
                    ? "text-primary"
                    : "text-subtle group-hover:text-muted"
                }
              />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Admin only */}
        {isAdmin && (
          <>
            <div className="border-t border-border my-3" />
            <Link
              href="/users"
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                pathname === "/users"
                  ? "bg-accent-light text-accent-text"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {pathname === "/users" && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
              )}
              <UserPlus
                size={17}
                className={
                  pathname === "/users"
                    ? "text-accent-text"
                    : "text-subtle group-hover:text-muted"
                }
              />
              <span>Users</span>
            </Link>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-all hover:bg-background hover:text-foreground"
        >
          <LogOut size={17} className="text-subtle" />
          <span>Odjava</span>
        </button>
      </div>
    </aside>
  );
}
