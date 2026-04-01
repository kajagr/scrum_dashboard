"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function DocumentationPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch existing documentation
  useEffect(() => {
    async function fetchDoc() {
      try {
        const res = await fetch(`/api/projects/${projectId}/documentation`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load documentation.");
          return;
        }
        setContent(data.content ?? "");
      } catch {
        setError("Server connection error.");
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [projectId]);

  // Debounced autosave — saves 2s after user stops typing
  function handleChange(val: string) {
    setContent(val);
    setSuccess(null);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveDoc(val), 2000);
  }

  async function saveDoc(val: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/documentation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSuccess("Saved.");
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      setError("Server connection error.");
    } finally {
      setSaving(false);
    }
  }

  // Export
  function handleExport(format: "md" | "txt") {
    window.location.href = `/api/projects/${projectId}/documentation/export?format=${format}`;
  }

  // Import
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("This will replace the current documentation. Continue?")) {
      e.target.value = "";
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/projects/${projectId}/documentation/import`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to import.");
        return;
      }
      setContent(data.content ?? "");
      setSuccess("Imported successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Server connection error.");
    } finally {
      setImporting(false);
      e.target.value = "";
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
        <span className="text-sm">Loading documentation...</span>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Project
          </p>
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            Documentation
          </h1>
          <p className="text-sm text-muted mt-1">
            Shared project wiki — all members can edit
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-3 py-2 text-sm rounded-lg border border-border text-muted hover:text-foreground hover:border-primary transition-colors disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleImport}
          />

          {/* Export */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExport("md")}
              className="px-3 py-2 text-sm rounded-lg border border-border text-muted hover:text-foreground hover:border-primary transition-colors"
            >
              Export .md
            </button>
            <button
              onClick={() => handleExport("txt")}
              className="px-3 py-2 text-sm rounded-lg border border-border text-muted hover:text-foreground hover:border-primary transition-colors"
            >
              Export .txt
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-5 mb-2">
        {saving && <p className="text-xs text-muted">Saving...</p>}
        {success && !saving && (
          <p className="text-xs text-green-600">{success}</p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Start writing your project documentation here... (supports Markdown)"
        className="flex-1 w-full rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[500px]"
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-foreground)",
        }}
      />
    </div>
  );
}
