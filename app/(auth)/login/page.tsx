"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);

  const [isDark, setIsDark] = useState(true);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Napaka pri prijavi.");
      setLoading(false);
      return;
    }

    // Server pove ali je MFA potreben
    if (data.requiresMfa && data.factorId) {
      setMfaFactorId(data.factorId);
      setMfaRequired(true);
      setLoading(false);
      return;
    }

    router.push("/projects");
  };

  // MFA verifikacija
  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setMfaLoading(true);
    setError(null);

    try {
      const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode,
      });

      if (mfaError) {
        setError("Napačna koda. Poskusite znova.");
        setMfaLoading(false);
        return;
      }

      router.push("/projects");
    } catch {
      setError("Napaka pri preverjanju kode.");
      setMfaLoading(false);
    }
  };

  // light/dark mode
  useEffect(() => {
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

  const EyeIcon = ({ show }: { show: boolean }) => (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {show ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      ) : (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </>
      )}
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-background)] text-[var(--color-foreground)]">
      {/* Theme toggle — zgoraj desno */}
      <div className="fixed top-4 right-4">
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
      </div>
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-lg">
        <h1 className="mb-2 text-center font-[var(--font-display)] text-3xl font-bold">
          ScrumBoard
        </h1>

        {/* MFA korak */}
        {mfaRequired ? (
          <>
            <h2 className="mb-2 text-center text-lg text-[var(--color-muted)]">
              {t("twoFactor")}
            </h2>
            <p className="mb-6 text-center text-sm text-[var(--color-muted)]">
              {t("enterCode")}
            </p>
            <form onSubmit={handleMfaVerify} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                  {t("authCode")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="000000"
                  autoFocus
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-center text-2xl tracking-widest text-[var(--color-foreground)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]"
                />
              </div>
              {error && (
                <p className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-light)] px-3 py-2 text-sm text-[var(--color-error)]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={mfaLoading || mfaCode.length !== 6}
                className="w-full rounded-lg px-4 py-2 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
              >
                {mfaLoading ? t("verifying") : t("verify")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMfaRequired(false);
                  setMfaCode("");
                  setError(null);
                }}
                className="w-full text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition"
              >
                {t("backToLogin")}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="mb-6 text-center text-lg text-[var(--color-muted)]">
              {t("signInTitle")}
            </h2>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                  {t("email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[var(--color-foreground)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                  {t("password")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={
                      showPassword
                        ? password
                        : password
                            .split("")
                            .map((char, i) => (i === revealIndex ? char : "•"))
                            .join("")
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      let realValue: string;
                      if (showPassword) {
                        realValue = val;
                      } else {
                        if (val.length > password.length) {
                          realValue = password + val.slice(password.length);
                        } else {
                          realValue = password.slice(0, val.length);
                        }
                      }
                      setPassword(realValue);
                      if (!showPassword && realValue.length > 0) {
                        setRevealIndex(realValue.length - 1);
                        if (revealTimer.current)
                          clearTimeout(revealTimer.current);
                        revealTimer.current = setTimeout(
                          () => setRevealIndex(null),
                          1000,
                        );
                      } else {
                        setRevealIndex(null);
                      }
                    }}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    required
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 pr-10 text-[var(--color-foreground)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                  >
                    <EyeIcon show={showPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-light)] px-3 py-2 text-sm text-[var(--color-error)]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-2 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
              >
                {loading ? t("signingIn") : t("signIn")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
