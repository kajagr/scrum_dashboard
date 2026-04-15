"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import SettingsHelpTooltip from "@/components/features/settings/SettingsHelpTooltip";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const params = useParams();
  const projectId = params.projectId as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [canManage, setCanManage] = useState(false);

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setError("Failed to load project.");
          return;
        }
        const data = await res.json();
        setName(data.name ?? "");
        setDescription(data.description ?? "");
      } catch {
        setError("Server connection error.");
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [projectId]);

  // Check if current user can edit (admin or scrum_master)
  useEffect(() => {
    if (!projectId) return;
    async function checkPermission() {
      const [meRes, roleRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/members/me`, { cache: "no-store" }),
      ]);
      const me = meRes.ok ? await meRes.json() : null;
      const role = roleRes.ok ? await roleRes.json() : null;
      setCanManage(
        me?.system_role === "admin" || role?.role === "scrum_master",
      );
    }
    checkPermission();
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Server connection error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-subtle">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span className="text-sm">{t("loading")}</span>
      </div>
    );
  }

  return (
    <div className="p-6 text-foreground">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          {t("section")}
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            {t("title")}
          </h1>
          <SettingsHelpTooltip />
        </div>
        <p className="text-sm text-muted mt-1">{t("subtitle")}</p>
      </div>

      <div
        className="max-w-xl rounded-xl p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 className="mb-4 font-semibold text-foreground">{t("projectDetails")}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              {t("name")} {canManage && <span className="text-error">*</span>}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              required
              className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-error-border bg-error-light">
              <span className="text-error text-base mt-0.5">⚠</span>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-green-200 bg-green-50">
              <span className="text-green-600 text-base mt-0.5">✓</span>
              <p className="text-sm text-green-700">
                {t("savedSuccess")}
              </p>
            </div>
          )}

          {canManage && (
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t("saving") : t("saveChanges")}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
