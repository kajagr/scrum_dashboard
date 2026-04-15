"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import DocumentationHelpTooltip from "@/components/features/documentation/DocumentationHelpTooltip";

// ─── Markdown → HTML ──────────────────────────────────────────────────────────
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false,
    inOl = false;

  const closeList = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const inline = (text: string) =>
    text
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>") // ← _italic_ fix
      .replace(/~~(.+?)~~/g, "<s>$1</s>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^# /.test(line)) {
      closeList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (/^## /.test(line)) {
      closeList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (/^### /.test(line)) {
      closeList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (/^> /.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      closeList();
      out.push("<hr>");
      continue;
    }

    if (/^[-*] /.test(line)) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      closeList();
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("");
}

// ─── HTML → Markdown ──────────────────────────────────────────────────────────
function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;

  function proc(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(proc).join("");

    switch (tag) {
      case "b":
      case "strong": {
        const t = inner.replace(/\n/g, "");
        return t ? `<strong>${t}</strong>` : "";
      }

      case "i":
      case "em": {
        const t = inner.replace(/\n/g, "");
        return t ? `<em>${t}</em>` : "";
      }

      case "s":
      case "del": {
        const t = inner.replace(/\n/g, "");
        return t ? `~~${t}~~` : "";
      }

      case "code": {
        const t = inner.replace(/\n/g, "");
        return t ? `\`${t}\`` : "";
      }

      case "pre":
        return `\`\`\`\n${el.textContent ?? ""}\n\`\`\`\n\n`;

      case "h1":
        return `# ${inner.trim()}\n\n`;

      case "h2":
        return `## ${inner.trim()}\n\n`;

      case "h3":
        return `### ${inner.trim()}\n\n`;

      case "p":
      case "div": {
        const textContent = (el.textContent ?? "")
          .replace(/\u00A0/g, " ")
          .trim();
        if (!textContent) return "";
        return `${inner}\n\n`;
      }

      case "br":
        return "\n";

      case "ul":
        return (
          Array.from(el.children)
            .map((li) => `- ${proc(li).trim()}`)
            .join("\n") + "\n\n"
        );

      case "ol":
        return (
          Array.from(el.children)
            .map((li, i) => `${i + 1}. ${proc(li).trim()}`)
            .join("\n") + "\n\n"
        );

      case "li":
        return inner;

      case "blockquote": {
        const text = inner
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => `> ${l}`)
          .join("\n");

        return text ? `${text}\n\n` : "";
      }

      case "a":
        return `[${inner}](${el.getAttribute("href") ?? ""})`;

      case "hr":
        return `---\n\n`;

      default:
        return inner;
    }
  }

  return proc(div)
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── HTML → plain text ────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const BLOCK = new Set([
    "p",
    "div",
    "h1",
    "h2",
    "h3",
    "li",
    "blockquote",
    "pre",
    "hr",
  ]);
  function proc(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";
    const inner = Array.from(el.childNodes).map(proc).join("");
    if (tag === "p") {
      // Prazni <p> ali <p><br></p> → prazna vrstica, vsebinski → vsebina + \n
      const content = inner.replace(/\n/g, " ").trim();
      return content + "\n";
    }
    return BLOCK.has(tag) ? inner.trimEnd() + "\n" : inner;
  }
  return proc(div).trimEnd();
}

// ─── Toolbar button ───────────────────────────────────────────────────────────
function ToolbarBtn({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={[
        "flex items-center justify-center w-8 h-8 rounded-md text-sm transition-colors select-none cursor-pointer",
        active
          ? "bg-primary text-white"
          : "text-muted hover:bg-primary hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const Divider = () => (
  <div className="w-px h-5 bg-[var(--color-border)] mx-1 shrink-0" />
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DocumentationPage() {
  const t = useTranslations("documentation");
  const params = useParams();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [initialHtml, setInitialHtml] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const htmlRef = useRef<string>("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        const html = data.content ?? "";
        htmlRef.current = html;
        setInitialHtml(html); // ← shrani v state, ne direktno v DOM
      } catch {
        setError("Server connection error.");
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [projectId]);

  // Ko loading konča in je editor v DOM-u, nastavi vsebino
  useEffect(() => {
    if (!loading && initialHtml !== null && editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [loading, initialHtml]);

  const saveDoc = useCallback(
    async (html: string) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/documentation`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to save.");
          return;
        }
        setSuccess(t("saved"));
        setTimeout(() => setSuccess(null), 2000);
      } catch {
        setError("Server connection error.");
      } finally {
        setSaving(false);
      }
    },
    [projectId],
  );

  function handleInput() {
    const html = editorRef.current?.innerHTML ?? "";
    htmlRef.current = html;
    setSuccess(null);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveDoc(html), 2000);
    refreshActiveFormats();
  }

  function refreshActiveFormats() {
    const formats = new Set<string>();
    [
      "bold",
      "italic",
      "strikeThrough",
      "insertUnorderedList",
      "insertOrderedList",
    ].forEach((cmd) => {
      try {
        if (document.queryCommandState(cmd)) formats.add(cmd);
      } catch {}
    });
    setActiveFormats(formats);
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  const handleExportMd = () => {
    const md = htmlToMarkdown(htmlRef.current);
    console.log("RAW markdown:\n" + md); // ← zamenjaj obstoječi log
    downloadBlob(md, "documentation.md", "text/markdown;charset=utf-8");
  };
  const handleExportTxt = () =>
    downloadBlob(
      htmlToText(htmlRef.current),
      "documentation.txt",
      "text/plain;charset=utf-8",
    );
  const handleExportPdf = () => {
    const content = editorRef.current?.innerHTML ?? "";
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Documentation</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.65; color: #111; padding: 2.5cm; max-width: 21cm; }
          h1 { font-size: 22pt; font-weight: 700; margin: 1rem 0 0.4rem; }
          h2 { font-size: 17pt; font-weight: 700; margin: 0.9rem 0 0.3rem; }
          h3 { font-size: 13pt; font-weight: 600; margin: 0.7rem 0 0.25rem; }
          p  { margin: 0.25rem 0; }
          ul { list-style: disc;    padding-left: 1.4rem; margin: 0.3rem 0; }
          ol { list-style: decimal; padding-left: 1.4rem; margin: 0.3rem 0; }
          li { margin: 0.1rem 0; }
          blockquote { border-left: 3px solid #5b8def; padding-left: 0.85rem; margin: 0.5rem 0; color: #555; font-style: italic; }
          code { font-family: "Courier New", monospace; font-size: 9.5pt; background: #f3f4f6; border-radius: 3px; padding: 0.1em 0.35em; }
          pre  { font-family: "Courier New", monospace; font-size: 9.5pt; background: #f3f4f6; border-radius: 6px; padding: 0.75rem 1rem; margin: 0.5rem 0; white-space: pre-wrap; word-break: break-all; }
          hr   { border: none; border-top: 1px solid #ddd; margin: 0.8rem 0; }
          a    { color: #5b8def; }
          strong { font-weight: 700; }
          em { font-style: italic; }
          @media print {
            body { padding: 0; }
            @page { margin: 2cm; }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
    printWindow.document.close();
    printWindow.focus();
    // Počakaj da se naloži nato print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
    setExportOpen(false);
  };

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(t("replaceConfirm"))) {
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
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to import.");
        return;
      }

      const raw = data.content ?? "";
      const ext = file.name.split(".").pop()?.toLowerCase();
      const html =
        ext === "md"
          ? markdownToHtml(raw)
          : raw
              .split("\n")
              .map((line: string) =>
                line.trim() ? `<p>${line}</p>` : "<p><br></p>",
              )
              .join("");

      htmlRef.current = html;
      if (editorRef.current) editorRef.current.innerHTML = html;
      await saveDoc(html);
      setSuccess(t("importedSuccess"));
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
      <div className="flex items-center gap-2 p-6 text-muted">
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
    <div className="p-6 flex flex-col" style={{ height: "100%" }}>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-shrink-0">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            {t("section")}
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              {t("title")}
            </h1>
            <DocumentationHelpTooltip />
          </div>
          <p className="text-sm text-muted mt-1">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {importing ? t("importing") : t("import")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleImport}
          />

          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("export")}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: exportOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {exportOpen && (
              <div
                className="absolute right-0 mt-1 w-44 rounded-lg border border-border shadow-lg z-50 overflow-hidden"
                style={{ background: "var(--color-surface)" }}
              >
                {[
                  { label: t("exportMd"), action: handleExportMd },
                  { label: t("exportTxt"), action: handleExportTxt },
                  { label: t("exportPdf"), action: handleExportPdf },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-foreground hover:bg-[var(--color-border)] transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-5 mb-2 flex-shrink-0">
        {saving && <p className="text-xs text-muted">{t("saving")}</p>}
        {success && !saving && (
          <p className="text-xs text-green-600">{success}</p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      {/* Editor container — flex-1 + overflow-hidden so editor scrolls inside */}
      <div
        className="flex flex-col flex-1 rounded-xl overflow-hidden min-h-0"
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center gap-0.5 px-3 py-2 flex-wrap flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <ToolbarBtn
            title={t("toolbar.h1")}
            onClick={() => exec("formatBlock", "h1")}
          >
            <span className="text-xs font-bold">H1</span>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.h2")}
            onClick={() => exec("formatBlock", "h2")}
          >
            <span className="text-xs font-bold">H2</span>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.h3")}
            onClick={() => exec("formatBlock", "h3")}
          >
            <span className="text-xs font-bold">H3</span>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.paragraph")}
            onClick={() => exec("formatBlock", "p")}
          >
            <span className="text-xs">¶</span>
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            title={t("toolbar.bold")}
            onClick={() => exec("bold")}
            active={activeFormats.has("bold")}
          >
            <span className="font-bold">B</span>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.italic")}
            onClick={() => exec("italic")}
            active={activeFormats.has("italic")}
          >
            <span className="italic">I</span>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.strikethrough")}
            onClick={() => exec("strikeThrough")}
            active={activeFormats.has("strikeThrough")}
          >
            <span className="line-through">S</span>
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            title={t("toolbar.bulletList")}
            onClick={() => exec("insertUnorderedList")}
            active={activeFormats.has("insertUnorderedList")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle
                cx="4"
                cy="12"
                r="1.5"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="4"
                cy="18"
                r="1.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.numberedList")}
            onClick={() => exec("insertOrderedList")}
            active={activeFormats.has("insertOrderedList")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="10" y1="6" x2="21" y2="6" />
              <line x1="10" y1="12" x2="21" y2="12" />
              <line x1="10" y1="18" x2="21" y2="18" />
              <path d="M4 6h1v4" />
              <path d="M4 10h2" />
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
            </svg>
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            title={t("toolbar.blockquote")}
            onClick={() => exec("formatBlock", "blockquote")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.horizontalRule")}
            onClick={() => exec("insertHorizontalRule")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            title={t("toolbar.insertLink")}
            onClick={() => {
              const url = prompt("URL:");
              if (url) exec("createLink", url);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            title={t("toolbar.removeFormatting")}
            onClick={() => exec("removeFormat")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7V4h16v3" />
              <path d="M5 20h6" />
              <path d="M13 4l-9 16" />
              <line x1="3" y1="3" x2="21" y2="21" />
            </svg>
          </ToolbarBtn>
        </div>

        {/* Editor — flex-1 + overflow-y-auto → scrollable ← key fix */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={refreshActiveFormats}
          onMouseUp={refreshActiveFormats}
          onSelect={refreshActiveFormats}
          data-placeholder={t("placeholder")}
          className="flex-1 p-4 text-sm focus:outline-none doc-editor"
          style={{
            color: "var(--color-foreground)",
            background: "var(--color-surface)",
            overflowY: "auto", // ← scroll fix
            minHeight: 0, // ← allows flex shrink + scroll
          }}
        />
      </div>

      <style>{`
        .doc-editor:empty:before { content: attr(data-placeholder); color: var(--color-muted); pointer-events: none; }
        .doc-editor h1 { font-size: 1.75rem; font-weight: 700; margin: 0.75rem 0 0.4rem; line-height: 1.2; }
        .doc-editor h2 { font-size: 1.35rem; font-weight: 700; margin: 0.6rem 0 0.3rem; line-height: 1.25; }
        .doc-editor h3 { font-size: 1.1rem;  font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .doc-editor p  { margin: 0.2rem 0; line-height: 1.65; }
        .doc-editor ul { list-style: disc;    padding-left: 1.4rem; margin: 0.3rem 0; }
        .doc-editor ol { list-style: decimal; padding-left: 1.4rem; margin: 0.3rem 0; }
        .doc-editor li { margin: 0.1rem 0; line-height: 1.6; }
        .doc-editor blockquote { border-left: 3px solid var(--color-primary); padding-left: 0.85rem; margin: 0.5rem 0; color: var(--color-muted); font-style: italic; }
        .doc-editor a    { color: var(--color-primary); text-decoration: underline; }
        .doc-editor hr   { border: none; border-top: 1px solid var(--color-border); margin: 0.8rem 0; }
        .doc-editor code { font-family: monospace; font-size: 0.85em; background: var(--color-border); border-radius: 3px; padding: 0.1em 0.35em; }
        .doc-editor pre  { background: var(--color-border); border-radius: 6px; padding: 0.75rem 1rem; margin: 0.5rem 0; overflow-x: auto; font-family: monospace; font-size: 0.85em; }
      `}</style>
    </div>
  );
}
