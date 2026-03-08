"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileModal from "@/components/features/users/ProfileModal";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

export default function Navbar() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/users/profile", {
          method: "GET",
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) return;

        setUser({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
        });
      } catch {
        // optional: handle error
      }
    };

    fetchProfile();
  }, []);

  const initials =
    `${user?.first_name?.charAt(0) ?? ""}${user?.last_name?.charAt(0) ?? ""}`.toUpperCase() ||
    "U";

  return (
    <>
      <nav className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 flex items-center justify-between">
        <Link href="/projects" className="text-xl font-bold text-[var(--color-foreground)]">
          ScrumBoard
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-border)] text-[var(--color-foreground)] font-medium rounded-md text-sm transition-colors"
          >
            <div className="w-7 h-7 bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--color-primary-border)] rounded-full flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>

            My Profile
          </button>

          <div className="text-sm text-[var(--color-muted)]">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </nav>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
}
