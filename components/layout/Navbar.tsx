"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileModal from "@/components/features/profile/ProfileModal";
import { formatDateDot, formatDateTimeDot } from "@/lib/datetime";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  last_login_at: string | null;
}

export default function Navbar() {
  const t = useTranslations("navbar");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDark, setIsDark] = useState(true);

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
          last_login_at: data.last_login_at || null,
        });
      } catch {
        // optional: handle error
      }
    };
    fetchProfile();

    // Load saved theme preference
    const saved = localStorage.getItem("theme");
    const dark = saved ? saved === "dark" : true;
    setIsDark(dark);
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  const initials =
    `${user?.first_name?.charAt(0) ?? ""}${user?.last_name?.charAt(0) ?? ""}`.toUpperCase() ||
    "U";

  return (
    <>
      <nav className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 flex items-center justify-between">
        <Link
          href="/projects"
          className="text-xl font-bold text-[var(--color-foreground)]"
        >
          ScrumBoard
        </Link>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <LanguageSwitcher />

          <button
            onClick={toggleTheme}
            title={isDark ? t("switchThemeLight") : t("switchThemeDark")}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary-border)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-primary)]"
          >
            {isDark ? (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="4" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                />
              </svg>
            )}
          </button>

          {/* Profile button */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-border)] text-[var(--color-foreground)] font-medium rounded-md text-sm transition-colors"
          >
            <div className="w-7 h-7 bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--color-primary-border)] rounded-full flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            {t("myProfile")}
          </button>

          <div className="text-right">
            <div className="text-sm text-[var(--color-muted)]">
              {new Date().toLocaleDateString("en-US", { weekday: "long" })},{" "}
              {formatDateDot(new Date())}
            </div>

            {user && (
              <div className="text-xs text-[var(--color-subtle)] mt-0.5">
                {user.last_login_at
                  ? t("lastLogin", { date: formatDateTimeDot(user.last_login_at) })
                  : t("firstLogin")}
              </div>
            )}
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
