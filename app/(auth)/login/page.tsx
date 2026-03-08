"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/projects");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="max-w-md w-full p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg">
        
        <h1 className="text-3xl font-bold text-center mb-2">
          ScrumBoard
        </h1>

      

        <form onSubmit={handleLogin} className="space-y-4">

          <div>
            <label className="block text-sm text-[var(--color-muted)]">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 rounded-md
              bg-[var(--color-background)]
              border border-[var(--color-border)]
              text-[var(--color-foreground)]
              focus:outline-none
              focus:border-[var(--color-primary)]
              focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-muted)]">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 rounded-md
              bg-[var(--color-background)]
              border border-[var(--color-border)]
              text-[var(--color-foreground)]
              focus:outline-none
              focus:border-[var(--color-primary)]
              focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--color-error)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md font-medium
            bg-[var(--color-primary)]
            hover:bg-[var(--color-primary-hover)]
            text-white
            disabled:opacity-50
            transition"
          >
            {loading ? "Loading..." : "Sign in"}
          </button>

        </form>

      </div>
    </div>
  );
}