"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { jsPDF } from "jspdf";

// ─── HTML → Markdown converter ───────────────────────────────────────────────
function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(processNode).join("");

    switch (tag) {
      case "b":
      case "strong":
        return `**${inner}**`;
      case "i":
      case "em":
        return `*${inner}*`;
      case "s":
      case "strike":
      case "del":
        return `~~${inner}~~`;
      case "code":
        return el.parentElement?.tagName.toLowerCase() === "pre"
          ? inner
          : `\`${inner}\``;
      case "pre":
        return `\`\`\`\n${inner}\n\`\`\`\n`;
      case "h1":
        return `# ${inner}\n`;
      case "h2":
        return `## ${inner}\n`;
      case "h3":
        return `### ${inner}\n`;
      case "p":
        return inner ? `${inner}\n\n` : "\n";
      case "br":
        return "\n";
      case "ul":
        return (
          Array.from(el.children)
            .map((li) => `- ${processNode(li)}`)
            .join("\n") + "\n"
        );
      case "ol":
        return (
          Array.from(el.children)
            .map((li, i) => `${i + 1}. ${processNode(li)}`)
            .join("\n") + "\n"
        );
      case "li":
        return inner;
      case "blockquote":
        return (
          inner
            .split("\n")
            .filter(Boolean)
            .map((l) => `> ${l}`)
            .join("\n") + "\n"
        );
      case "a": {
        const href = el.getAttribute("href") ?? "";
        return `[${inner}](${href})`;
      }
      case "hr":
        return "\n---\n";
      case "div":
        return inner ? `${inner}\n` : "";
      default:
        return inner;
    }
  }

  return processNode(div)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;

  const BLOCK_TAGS = new Set([
    "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "blockquote", "pre", "hr",
  ]);

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";

    const inner = Array.from(el.childNodes).map(processNode).join("");

    if (BLOCK_TAGS.has(tag)) {
      return inner.trimEnd() + "\n";
    }

    return inner;
  }

  return processNode(div)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
        e.preventDefault(); // keep editor focus
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
  const params = useParams();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const htmlRef = useRef<string>("");

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch documentation
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
        if (editorRef.current) editorRef.current.innerHTML = html;
      } catch {
        setError("Server connection error.");
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [projectId]);

  // Save
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
        setSuccess("Saved.");
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
    const cmds = ["bold", "italic", "strikeThrough", "insertUnorderedList", "insertOrderedList"];
    cmds.forEach((cmd) => {
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

  // ── Export ──
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

  function handleExportMd() {
    downloadBlob(htmlToMarkdown(htmlRef.current), "documentation.md", "text/markdown;charset=utf-8");
  }

  function handleExportTxt() {
    downloadBlob(htmlToText(htmlRef.current), "documentation.txt", "text/plain;charset=utf-8");
  }

  function handleExportPdf() {
    const txt = htmlToText(htmlRef.current);
    const doc = new jsPDF();
    const margin = 15;
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const lineHeight = 7;
    const blankGap = 4;
    let y = 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    // Split on newlines first, then word-wrap long lines
    txt.split("\n").forEach((para) => {
      if (para.trim() === "") {
        y += blankGap;
        if (y > pageHeight - margin) { doc.addPage(); y = margin; }
        return;
      }
      const wrapped = doc.splitTextToSize(para, maxWidth) as string[];
      wrapped.forEach((line) => {
        if (y > pageHeight - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += lineHeight;
      });
    });

    doc.save("documentation.pdf");
    setExportOpen(false);
  }

  // ── Import ──
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
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to import.");
        return;
      }
      // Backend returns raw text (markdown/plain); wrap in paragraphs for the editor
      const raw: string = data.content ?? "";
      const html = raw
        ? raw
            .split(/\n\n+/)
            .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
            .join("")
        : "";
      htmlRef.current = html;
      if (editorRef.current) editorRef.current.innerHTML = html;
      setSuccess("Imported successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Server connection error.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
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

        <div className="flex items-center gap-2">
          {/* Import */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {importing ? "Importing..." : "Import"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleImport}
          />

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
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
                  { label: "Markdown (.md)", action: handleExportMd },
                  { label: "Plain text (.txt)", action: handleExportTxt },
                  { label: "PDF (.pdf)", action: handleExportPdf },
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
      <div className="h-5 mb-2">
        {saving && <p className="text-xs text-muted">Saving...</p>}
        {success && !saving && <p className="text-xs text-green-600">{success}</p>}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      {/* Editor container */}
      <div
        className="flex flex-col flex-1 rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center gap-0.5 px-3 py-2 flex-wrap shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {/* Headings */}
          <ToolbarBtn title="Heading 1" onClick={() => exec("formatBlock", "h1")}>
            <span className="text-xs font-bold">H1</span>
          </ToolbarBtn>
          <ToolbarBtn title="Heading 2" onClick={() => exec("formatBlock", "h2")}>
            <span className="text-xs font-bold">H2</span>
          </ToolbarBtn>
          <ToolbarBtn title="Heading 3" onClick={() => exec("formatBlock", "h3")}>
            <span className="text-xs font-bold">H3</span>
          </ToolbarBtn>
          <ToolbarBtn title="Paragraph" onClick={() => exec("formatBlock", "p")}>
            <span className="text-xs">¶</span>
          </ToolbarBtn>

          <Divider />

          {/* Inline formatting */}
          <ToolbarBtn title="Bold" onClick={() => exec("bold")} active={activeFormats.has("bold")}>
            <span className="font-bold">B</span>
          </ToolbarBtn>
          <ToolbarBtn title="Italic" onClick={() => exec("italic")} active={activeFormats.has("italic")}>
            <span className="italic">I</span>
          </ToolbarBtn>
          <ToolbarBtn title="Strikethrough" onClick={() => exec("strikeThrough")} active={activeFormats.has("strikeThrough")}>
            <span className="line-through">S</span>
          </ToolbarBtn>

          <Divider />

          {/* Lists */}
          <ToolbarBtn
            title="Bulleted list"
            onClick={() => exec("insertUnorderedList")}
            active={activeFormats.has("insertUnorderedList")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            title="Numbered list"
            onClick={() => exec("insertOrderedList")}
            active={activeFormats.has("insertOrderedList")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="6" x2="21" y2="6" />
              <line x1="10" y1="12" x2="21" y2="12" />
              <line x1="10" y1="18" x2="21" y2="18" />
              <path d="M4 6h1v4" />
              <path d="M4 10h2" />
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
            </svg>
          </ToolbarBtn>

          <Divider />

          {/* Blockquote */}
          <ToolbarBtn title="Blockquote" onClick={() => exec("formatBlock", "blockquote")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            </svg>
          </ToolbarBtn>

          {/* Horizontal rule */}
          <ToolbarBtn title="Horizontal rule" onClick={() => exec("insertHorizontalRule")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </ToolbarBtn>

          <Divider />

          {/* Link */}
          <ToolbarBtn
            title="Insert link"
            onClick={() => {
              const url = prompt("URL:");
              if (url) exec("createLink", url);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </ToolbarBtn>

          {/* Remove formatting */}
          <ToolbarBtn title="Remove formatting" onClick={() => exec("removeFormat")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V4h16v3" />
              <path d="M5 20h6" />
              <path d="M13 4l-9 16" />
              <line x1="3" y1="3" x2="21" y2="21" />
            </svg>
          </ToolbarBtn>
        </div>

        {/* Contenteditable rich text area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={refreshActiveFormats}
          onMouseUp={refreshActiveFormats}
          onSelect={refreshActiveFormats}
          data-placeholder="Start writing your project documentation here..."
          className="flex-1 p-4 text-sm overflow-y-auto focus:outline-none min-h-[500px] doc-editor"
          style={{ color: "var(--color-foreground)", background: "var(--color-surface)" }}
        />
      </div>

      {/* Scoped styles for the editor content */}
      <style>{`
        .doc-editor:empty:before {
          content: attr(data-placeholder);
          color: var(--color-muted);
          pointer-events: none;
        }
        .doc-editor h1 { font-size: 1.75rem; font-weight: 700; margin: 0.75rem 0 0.4rem; line-height: 1.2; }
        .doc-editor h2 { font-size: 1.35rem; font-weight: 700; margin: 0.6rem 0 0.3rem; line-height: 1.25; }
        .doc-editor h3 { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .doc-editor p  { margin: 0.2rem 0; line-height: 1.65; }
        .doc-editor ul { list-style: disc; padding-left: 1.4rem; margin: 0.3rem 0; }
        .doc-editor ol { list-style: decimal; padding-left: 1.4rem; margin: 0.3rem 0; }
        .doc-editor li { margin: 0.1rem 0; line-height: 1.6; }
        .doc-editor blockquote {
          border-left: 3px solid var(--color-primary);
          padding-left: 0.85rem;
          margin: 0.5rem 0;
          color: var(--color-muted);
          font-style: italic;
        }
        .doc-editor a { color: var(--color-primary); text-decoration: underline; }
        .doc-editor hr { border: none; border-top: 1px solid var(--color-border); margin: 0.8rem 0; }
        .doc-editor code {
          font-family: monospace;
          font-size: 0.85em;
          background: var(--color-border);
          border-radius: 3px;
          padding: 0.1em 0.35em;
        }
        .doc-editor pre {
          background: var(--color-border);
          border-radius: 6px;
          padding: 0.75rem 1rem;
          margin: 0.5rem 0;
          overflow-x: auto;
          font-family: monospace;
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
}