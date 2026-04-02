// "use client";

// import { useEffect, useRef, useState, useCallback } from "react";
// import { useParams } from "next/navigation";
// import { jsPDF } from "jspdf";

// // ─── Markdown → HTML ──────────────────────────────────────────────────────────
// function markdownToHtml(md: string): string {
//   const lines = md.split("\n");
//   const out: string[] = [];
//   let inUl = false,
//     inOl = false;

//   const closeList = () => {
//     if (inUl) {
//       out.push("</ul>");
//       inUl = false;
//     }
//     if (inOl) {
//       out.push("</ol>");
//       inOl = false;
//     }
//   };

//   const inline = (text: string) =>
//     text
//       .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
//       .replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
//       .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
//       .replace(/__(.+?)__/g, "<strong>$1</strong>")
//       .replace(/\*(.+?)\*/g, "<em>$1</em>")
//       .replace(/_([^_]+)_/g, "<em>$1</em>") // ← _italic_ fix
//       .replace(/~~(.+?)~~/g, "<s>$1</s>")
//       .replace(/`(.+?)`/g, "<code>$1</code>")
//       .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

//   for (const raw of lines) {
//     const line = raw.trimEnd();
//     if (/^# /.test(line)) {
//       closeList();
//       out.push(`<h1>${inline(line.slice(2))}</h1>`);
//       continue;
//     }
//     if (/^## /.test(line)) {
//       closeList();
//       out.push(`<h2>${inline(line.slice(3))}</h2>`);
//       continue;
//     }
//     if (/^### /.test(line)) {
//       closeList();
//       out.push(`<h3>${inline(line.slice(4))}</h3>`);
//       continue;
//     }
//     if (/^> /.test(line)) {
//       closeList();
//       out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
//       continue;
//     }
//     if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
//       closeList();
//       out.push("<hr>");
//       continue;
//     }

//     if (/^[-*] /.test(line)) {
//       if (inOl) {
//         out.push("</ol>");
//         inOl = false;
//       }
//       if (!inUl) {
//         out.push("<ul>");
//         inUl = true;
//       }
//       out.push(`<li>${inline(line.slice(2))}</li>`);
//       continue;
//     }
//     if (/^\d+\. /.test(line)) {
//       if (inUl) {
//         out.push("</ul>");
//         inUl = false;
//       }
//       if (!inOl) {
//         out.push("<ol>");
//         inOl = true;
//       }
//       out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
//       continue;
//     }
//     if (line.trim() === "") {
//       closeList();
//       out.push("<p><br></p>");
//       continue;
//     }
//     closeList();
//     out.push(`<p>${inline(line)}</p>`);
//   }
//   closeList();
//   return out.join("");
// }

// // ─── HTML → Markdown ──────────────────────────────────────────────────────────
// function htmlToMarkdown(html: string): string {
//   const div = document.createElement("div");
//   div.innerHTML = html;
//   function proc(node: Node): string {
//     if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
//     if (node.nodeType !== Node.ELEMENT_NODE) return "";
//     const el = node as HTMLElement;
//     const tag = el.tagName.toLowerCase();
//     const inner = Array.from(el.childNodes).map(proc).join("");
//     switch (tag) {
//       case "b":
//       case "strong":
//         return `**${inner}**`;
//       case "i":
//       case "em":
//         return `*${inner}*`;
//       case "s":
//       case "del":
//         return `~~${inner}~~`;
//       case "code":
//         return `\`${inner}\``;
//       case "pre":
//         return `\`\`\`\n${inner}\n\`\`\`\n`;
//       case "h1":
//         return `# ${inner}\n`;
//       case "h2":
//         return `## ${inner}\n`;
//       case "h3":
//         return `### ${inner}\n`;
//       case "p":
//         return inner ? `${inner}\n\n` : "\n";
//       case "br":
//         return "\n";
//       case "ul":
//         return (
//           Array.from(el.children)
//             .map((li) => `- ${proc(li)}`)
//             .join("\n") + "\n"
//         );
//       case "ol":
//         return (
//           Array.from(el.children)
//             .map((li, i) => `${i + 1}. ${proc(li)}`)
//             .join("\n") + "\n"
//         );
//       case "li":
//         return inner;
//       case "blockquote":
//         return (
//           inner
//             .split("\n")
//             .filter(Boolean)
//             .map((l) => `> ${l}`)
//             .join("\n") + "\n"
//         );
//       case "a":
//         return `[${inner}](${el.getAttribute("href") ?? ""})`;
//       case "hr":
//         return "\n---\n";
//       default:
//         return inner;
//     }
//   }
//   return proc(div)
//     .replace(/\n{3,}/g, "\n\n")
//     .trim();
// }

// // ─── HTML → plain text ────────────────────────────────────────────────────────
// function htmlToText(html: string): string {
//   const div = document.createElement("div");
//   div.innerHTML = html;
//   const BLOCK = new Set([
//     "p",
//     "div",
//     "h1",
//     "h2",
//     "h3",
//     "li",
//     "blockquote",
//     "pre",
//     "hr",
//   ]);
//   function proc(node: Node): string {
//     if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
//     if (node.nodeType !== Node.ELEMENT_NODE) return "";
//     const el = node as HTMLElement;
//     const tag = el.tagName.toLowerCase();
//     if (tag === "br") return "\n";
//     if (tag === "hr") return "\n---\n";
//     const inner = Array.from(el.childNodes).map(proc).join("");
//     return BLOCK.has(tag) ? inner.trimEnd() + "\n" : inner;
//   }
//   return proc(div)
//     .replace(/\n{3,}/g, "\n\n")
//     .trim();
// }

// // ─── PDF renderer (no html2canvas needed) ─────────────────────────────────────
// type Run = { text: string; bold: boolean; italic: boolean };

// function collectRuns(node: Node, bold = false, italic = false): Run[] {
//   if (node.nodeType === Node.TEXT_NODE) {
//     const text = node.textContent ?? "";
//     return text ? [{ text, bold, italic }] : [];
//   }
//   if (node.nodeType !== Node.ELEMENT_NODE) return [];
//   const el = node as HTMLElement;
//   const tag = el.tagName.toLowerCase();
//   const b = bold || tag === "b" || tag === "strong";
//   const i = italic || tag === "i" || tag === "em";
//   return Array.from(el.childNodes).flatMap((c) => collectRuns(c, b, i));
// }

// function renderRunsToDoc(
//   doc: jsPDF,
//   runs: Run[],
//   x: number,
//   startY: number,
//   fontSize: number,
//   lineH: number,
//   maxW: number,
//   pageH: number,
//   margin: number,
// ): number {
//   let y = startY;

//   // Build word tokens with their run metadata
//   type Token = { word: string; bold: boolean; italic: boolean };
//   const tokens: Token[] = [];
//   for (const run of runs) {
//     const words = run.text.split(/(\s+)/);
//     for (const w of words) {
//       if (w) tokens.push({ word: w, bold: run.bold, italic: run.italic });
//     }
//   }

//   let lineTokens: Token[] = [];
//   let lineW = 0;

//   const flushLine = () => {
//     if (!lineTokens.length) return;
//     let lx = x;
//     for (const t of lineTokens) {
//       const style =
//         t.bold && t.italic
//           ? "bolditalic"
//           : t.bold
//             ? "bold"
//             : t.italic
//               ? "italic"
//               : "normal";
//       doc.setFont("helvetica", style);
//       doc.setFontSize(fontSize);
//       doc.text(t.word, lx, y);
//       lx += doc.getTextWidth(t.word);
//     }
//     y += lineH;
//     if (y > pageH - margin) {
//       doc.addPage();
//       y = margin;
//     }
//     lineTokens = [];
//     lineW = 0;
//   };

//   for (const token of tokens) {
//     const style =
//       token.bold && token.italic
//         ? "bolditalic"
//         : token.bold
//           ? "bold"
//           : token.italic
//             ? "italic"
//             : "normal";
//     doc.setFont("helvetica", style);
//     doc.setFontSize(fontSize);
//     const w = doc.getTextWidth(token.word);

//     if (lineW + w > maxW && lineW > 0) flushLine();
//     lineTokens.push(token);
//     lineW += w;
//   }
//   flushLine();
//   return y;
// }

// function exportHtmlToPdf(editorEl: HTMLElement) {
//   const doc = new jsPDF({ unit: "pt", format: "a4" });
//   const margin = 50;
//   const pageW = doc.internal.pageSize.getWidth();
//   const pageH = doc.internal.pageSize.getHeight();
//   const maxW = pageW - margin * 2;
//   let y = margin;

//   const check = (needed: number) => {
//     if (y + needed > pageH - margin) {
//       doc.addPage();
//       y = margin;
//     }
//   };

//   for (const child of Array.from(editorEl.children)) {
//     const el = child as HTMLElement;
//     const tag = el.tagName.toLowerCase();

//     if (tag === "h1") {
//       check(32);
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(22);
//       y = renderRunsToDoc(
//         doc,
//         collectRuns(el, true),
//         margin,
//         y,
//         22,
//         30,
//         maxW,
//         pageH,
//         margin,
//       );
//       y += 6;
//     } else if (tag === "h2") {
//       check(26);
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(17);
//       y = renderRunsToDoc(
//         doc,
//         collectRuns(el, true),
//         margin,
//         y,
//         17,
//         24,
//         maxW,
//         pageH,
//         margin,
//       );
//       y += 4;
//     } else if (tag === "h3") {
//       check(22);
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(13);
//       y = renderRunsToDoc(
//         doc,
//         collectRuns(el, true),
//         margin,
//         y,
//         13,
//         20,
//         maxW,
//         pageH,
//         margin,
//       );
//       y += 3;
//     } else if (tag === "p") {
//       const runs = collectRuns(el);
//       const text = runs
//         .map((r) => r.text)
//         .join("")
//         .trim();
//       if (!text) {
//         y += 8;
//         continue;
//       }
//       check(16);
//       y = renderRunsToDoc(doc, runs, margin, y, 11, 16, maxW, pageH, margin);
//       y += 3;
//     } else if (tag === "ul" || tag === "ol") {
//       Array.from(el.children).forEach((li, i) => {
//         check(16);
//         const bullet = tag === "ul" ? "• " : `${i + 1}. `;
//         doc.setFont("helvetica", "normal");
//         doc.setFontSize(11);
//         const bw = doc.getTextWidth(bullet);
//         doc.text(bullet, margin, y);
//         y = renderRunsToDoc(
//           doc,
//           collectRuns(li as HTMLElement),
//           margin + bw,
//           y,
//           11,
//           16,
//           maxW - bw,
//           pageH,
//           margin,
//         );
//       });
//       y += 4;
//     } else if (tag === "blockquote") {
//       check(16);
//       doc.setDrawColor(91, 141, 239);
//       doc.line(margin - 10, y - 11, margin - 10, y + 5);
//       doc.setDrawColor(0);
//       y = renderRunsToDoc(
//         doc,
//         collectRuns(el, false, true),
//         margin,
//         y,
//         11,
//         16,
//         maxW,
//         pageH,
//         margin,
//       );
//       y += 4;
//     } else if (tag === "hr") {
//       check(20);
//       doc.setDrawColor(180, 180, 180);
//       doc.line(margin, y, pageW - margin, y);
//       doc.setDrawColor(0);
//       y += 14;
//     }
//   }

//   doc.save("documentation.pdf");
// }

// // ─── Toolbar button ───────────────────────────────────────────────────────────
// function ToolbarBtn({
//   title,
//   onClick,
//   active,
//   children,
// }: {
//   title: string;
//   onClick: () => void;
//   active?: boolean;
//   children: React.ReactNode;
// }) {
//   return (
//     <button
//       type="button"
//       title={title}
//       onMouseDown={(e) => {
//         e.preventDefault();
//         onClick();
//       }}
//       className={[
//         "flex items-center justify-center w-8 h-8 rounded-md text-sm transition-colors select-none cursor-pointer",
//         active
//           ? "bg-primary text-white"
//           : "text-muted hover:bg-primary hover:text-white",
//       ].join(" ")}
//     >
//       {children}
//     </button>
//   );
// }

// const Divider = () => (
//   <div className="w-px h-5 bg-[var(--color-border)] mx-1 shrink-0" />
// );

// // ─── Page ─────────────────────────────────────────────────────────────────────
// export default function DocumentationPage() {
//   const params = useParams();
//   const projectId = params.projectId as string;

//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [importing, setImporting] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState<string | null>(null);
//   const [exportOpen, setExportOpen] = useState(false);
//   const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
//   const [initialHtml, setInitialHtml] = useState<string | null>(null);

//   const editorRef = useRef<HTMLDivElement>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const exportRef = useRef<HTMLDivElement>(null);
//   const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
//   const htmlRef = useRef<string>("");

//   useEffect(() => {
//     const handler = (e: MouseEvent) => {
//       if (exportRef.current && !exportRef.current.contains(e.target as Node))
//         setExportOpen(false);
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   useEffect(() => {
//     async function fetchDoc() {
//       try {
//         const res = await fetch(`/api/projects/${projectId}/documentation`, {
//           cache: "no-store",
//         });
//         const data = await res.json();
//         if (!res.ok) {
//           setError(data.error ?? "Failed to load documentation.");
//           return;
//         }
//         const html = data.content ?? "";
//         htmlRef.current = html;
//         setInitialHtml(html); // ← shrani v state, ne direktno v DOM
//       } catch {
//         setError("Server connection error.");
//       } finally {
//         setLoading(false);
//       }
//     }
//     fetchDoc();
//   }, [projectId]);

//   // Ko loading konča in je editor v DOM-u, nastavi vsebino
//   useEffect(() => {
//     if (!loading && initialHtml !== null && editorRef.current) {
//       editorRef.current.innerHTML = initialHtml;
//     }
//   }, [loading, initialHtml]);

//   const saveDoc = useCallback(
//     async (html: string) => {
//       setSaving(true);
//       setError(null);
//       try {
//         const res = await fetch(`/api/projects/${projectId}/documentation`, {
//           method: "PUT",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ content: html }),
//         });
//         const data = await res.json();
//         if (!res.ok) {
//           setError(data.error ?? "Failed to save.");
//           return;
//         }
//         setSuccess("Saved.");
//         setTimeout(() => setSuccess(null), 2000);
//       } catch {
//         setError("Server connection error.");
//       } finally {
//         setSaving(false);
//       }
//     },
//     [projectId],
//   );

//   function handleInput() {
//     const html = editorRef.current?.innerHTML ?? "";
//     htmlRef.current = html;
//     setSuccess(null);
//     if (saveTimeout.current) clearTimeout(saveTimeout.current);
//     saveTimeout.current = setTimeout(() => saveDoc(html), 2000);
//     refreshActiveFormats();
//   }

//   function refreshActiveFormats() {
//     const formats = new Set<string>();
//     [
//       "bold",
//       "italic",
//       "strikeThrough",
//       "insertUnorderedList",
//       "insertOrderedList",
//     ].forEach((cmd) => {
//       try {
//         if (document.queryCommandState(cmd)) formats.add(cmd);
//       } catch {}
//     });
//     setActiveFormats(formats);
//   }

//   function exec(command: string, value?: string) {
//     editorRef.current?.focus();
//     document.execCommand(command, false, value);
//     handleInput();
//   }

//   function downloadBlob(content: string, filename: string, mime: string) {
//     const blob = new Blob([content], { type: mime });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = filename;
//     a.click();
//     URL.revokeObjectURL(url);
//     setExportOpen(false);
//   }

//   const handleExportMd = () =>
//     downloadBlob(
//       htmlToMarkdown(htmlRef.current),
//       "documentation.md",
//       "text/markdown;charset=utf-8",
//     );
//   const handleExportTxt = () =>
//     downloadBlob(
//       htmlToText(htmlRef.current),
//       "documentation.txt",
//       "text/plain;charset=utf-8",
//     );
//   const handleExportPdf = () => {
//     if (editorRef.current) exportHtmlToPdf(editorRef.current);
//     setExportOpen(false);
//   };

//   async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     if (!confirm("This will replace the current documentation. Continue?")) {
//       e.target.value = "";
//       return;
//     }
//     setImporting(true);
//     setError(null);
//     try {
//       const formData = new FormData();
//       formData.append("file", file);
//       const res = await fetch(
//         `/api/projects/${projectId}/documentation/import`,
//         { method: "POST", body: formData },
//       );
//       const data = await res.json();
//       if (!res.ok) {
//         setError(data.error ?? "Failed to import.");
//         return;
//       }

//       const raw = data.content ?? "";
//       const ext = file.name.split(".").pop()?.toLowerCase();
//       const html =
//         ext === "md"
//           ? markdownToHtml(raw)
//           : raw
//               .split(/\n\n+/)
//               .map((b: string) => `<p>${b.replace(/\n/g, "<br>")}</p>`)
//               .join("");

//       htmlRef.current = html;
//       if (editorRef.current) editorRef.current.innerHTML = html;
//       await saveDoc(html);
//       setSuccess("Imported successfully.");
//       setTimeout(() => setSuccess(null), 3000);
//     } catch {
//       setError("Server connection error.");
//     } finally {
//       setImporting(false);
//       e.target.value = "";
//     }
//   }

//   if (loading) {
//     return (
//       <div className="flex items-center gap-2 p-6 text-muted">
//         <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
//           <circle
//             className="opacity-25"
//             cx="12"
//             cy="12"
//             r="10"
//             stroke="currentColor"
//             strokeWidth="4"
//           />
//           <path
//             className="opacity-75"
//             fill="currentColor"
//             d="M4 12a8 8 0 018-8v8H4z"
//           />
//         </svg>
//         <span className="text-sm">Loading documentation...</span>
//       </div>
//     );
//   }

//   return (
//     <div className="p-6 flex flex-col" style={{ height: "100%" }}>
//       {/* Header */}
//       <div className="flex items-end justify-between mb-4 flex-shrink-0">
//         <div>
//           <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
//             Project
//           </p>
//           <h1 className="text-3xl font-bold text-foreground leading-tight">
//             Documentation
//           </h1>
//           <p className="text-sm text-muted mt-1">
//             Shared project wiki — all members can edit
//           </p>
//         </div>

//         <div className="flex items-center gap-2">
//           <button
//             type="button"
//             onClick={() => fileInputRef.current?.click()}
//             disabled={importing}
//             className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50"
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="14"
//               height="14"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
//               <polyline points="17 8 12 3 7 8" />
//               <line x1="12" y1="3" x2="12" y2="15" />
//             </svg>
//             {importing ? "Importing..." : "Import"}
//           </button>
//           <input
//             ref={fileInputRef}
//             type="file"
//             accept=".md,.txt"
//             className="hidden"
//             onChange={handleImport}
//           />

//           <div className="relative" ref={exportRef}>
//             <button
//               type="button"
//               onClick={() => setExportOpen((v) => !v)}
//               className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
//             >
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 width="14"
//                 height="14"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//               >
//                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
//                 <polyline points="7 10 12 15 17 10" />
//                 <line x1="12" y1="15" x2="12" y2="3" />
//               </svg>
//               Export
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 width="12"
//                 height="12"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 style={{
//                   transform: exportOpen ? "rotate(180deg)" : "rotate(0deg)",
//                   transition: "transform 0.15s",
//                 }}
//               >
//                 <polyline points="6 9 12 15 18 9" />
//               </svg>
//             </button>
//             {exportOpen && (
//               <div
//                 className="absolute right-0 mt-1 w-44 rounded-lg border border-border shadow-lg z-50 overflow-hidden"
//                 style={{ background: "var(--color-surface)" }}
//               >
//                 {[
//                   { label: "Markdown (.md)", action: handleExportMd },
//                   { label: "Plain text (.txt)", action: handleExportTxt },
//                   { label: "PDF (.pdf)", action: handleExportPdf },
//                 ].map((item) => (
//                   <button
//                     key={item.label}
//                     type="button"
//                     onClick={item.action}
//                     className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-foreground hover:bg-[var(--color-border)] transition-colors"
//                   >
//                     {item.label}
//                   </button>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Status bar */}
//       <div className="h-5 mb-2 flex-shrink-0">
//         {saving && <p className="text-xs text-muted">Saving...</p>}
//         {success && !saving && (
//           <p className="text-xs text-green-600">{success}</p>
//         )}
//         {error && <p className="text-xs text-error">{error}</p>}
//       </div>

//       {/* Editor container — flex-1 + overflow-hidden so editor scrolls inside */}
//       <div
//         className="flex flex-col flex-1 rounded-xl overflow-hidden min-h-0"
//         style={{
//           border: "1px solid var(--color-border)",
//           background: "var(--color-surface)",
//         }}
//       >
//         {/* Toolbar */}
//         <div
//           className="flex items-center gap-0.5 px-3 py-2 flex-wrap flex-shrink-0"
//           style={{ borderBottom: "1px solid var(--color-border)" }}
//         >
//           <ToolbarBtn
//             title="Heading 1"
//             onClick={() => exec("formatBlock", "h1")}
//           >
//             <span className="text-xs font-bold">H1</span>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Heading 2"
//             onClick={() => exec("formatBlock", "h2")}
//           >
//             <span className="text-xs font-bold">H2</span>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Heading 3"
//             onClick={() => exec("formatBlock", "h3")}
//           >
//             <span className="text-xs font-bold">H3</span>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Paragraph"
//             onClick={() => exec("formatBlock", "p")}
//           >
//             <span className="text-xs">¶</span>
//           </ToolbarBtn>
//           <Divider />
//           <ToolbarBtn
//             title="Bold"
//             onClick={() => exec("bold")}
//             active={activeFormats.has("bold")}
//           >
//             <span className="font-bold">B</span>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Italic"
//             onClick={() => exec("italic")}
//             active={activeFormats.has("italic")}
//           >
//             <span className="italic">I</span>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Strikethrough"
//             onClick={() => exec("strikeThrough")}
//             active={activeFormats.has("strikeThrough")}
//           >
//             <span className="line-through">S</span>
//           </ToolbarBtn>
//           <Divider />
//           <ToolbarBtn
//             title="Bulleted list"
//             onClick={() => exec("insertUnorderedList")}
//             active={activeFormats.has("insertUnorderedList")}
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="15"
//               height="15"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <line x1="9" y1="6" x2="20" y2="6" />
//               <line x1="9" y1="12" x2="20" y2="12" />
//               <line x1="9" y1="18" x2="20" y2="18" />
//               <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
//               <circle
//                 cx="4"
//                 cy="12"
//                 r="1.5"
//                 fill="currentColor"
//                 stroke="none"
//               />
//               <circle
//                 cx="4"
//                 cy="18"
//                 r="1.5"
//                 fill="currentColor"
//                 stroke="none"
//               />
//             </svg>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Numbered list"
//             onClick={() => exec("insertOrderedList")}
//             active={activeFormats.has("insertOrderedList")}
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="15"
//               height="15"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <line x1="10" y1="6" x2="21" y2="6" />
//               <line x1="10" y1="12" x2="21" y2="12" />
//               <line x1="10" y1="18" x2="21" y2="18" />
//               <path d="M4 6h1v4" />
//               <path d="M4 10h2" />
//               <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
//             </svg>
//           </ToolbarBtn>
//           <Divider />
//           <ToolbarBtn
//             title="Blockquote"
//             onClick={() => exec("formatBlock", "blockquote")}
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="15"
//               height="15"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
//               <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
//             </svg>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Horizontal rule"
//             onClick={() => exec("insertHorizontalRule")}
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="15"
//               height="15"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <line x1="5" y1="12" x2="19" y2="12" />
//             </svg>
//           </ToolbarBtn>
//           <Divider />
//           <ToolbarBtn
//             title="Insert link"
//             onClick={() => {
//               const url = prompt("URL:");
//               if (url) exec("createLink", url);
//             }}
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="15"
//               height="15"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
//               <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
//             </svg>
//           </ToolbarBtn>
//           <ToolbarBtn
//             title="Remove formatting"
//             onClick={() => exec("removeFormat")}
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="15"
//               height="15"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <path d="M4 7V4h16v3" />
//               <path d="M5 20h6" />
//               <path d="M13 4l-9 16" />
//               <line x1="3" y1="3" x2="21" y2="21" />
//             </svg>
//           </ToolbarBtn>
//         </div>

//         {/* Editor — flex-1 + overflow-y-auto → scrollable ← key fix */}
//         <div
//           ref={editorRef}
//           contentEditable
//           suppressContentEditableWarning
//           onInput={handleInput}
//           onKeyUp={refreshActiveFormats}
//           onMouseUp={refreshActiveFormats}
//           onSelect={refreshActiveFormats}
//           data-placeholder="Start writing your project documentation here..."
//           className="flex-1 p-4 text-sm focus:outline-none doc-editor"
//           style={{
//             color: "var(--color-foreground)",
//             background: "var(--color-surface)",
//             overflowY: "auto", // ← scroll fix
//             minHeight: 0, // ← allows flex shrink + scroll
//           }}
//         />
//       </div>

//       <style>{`
//         .doc-editor:empty:before { content: attr(data-placeholder); color: var(--color-muted); pointer-events: none; }
//         .doc-editor h1 { font-size: 1.75rem; font-weight: 700; margin: 0.75rem 0 0.4rem; line-height: 1.2; }
//         .doc-editor h2 { font-size: 1.35rem; font-weight: 700; margin: 0.6rem 0 0.3rem; line-height: 1.25; }
//         .doc-editor h3 { font-size: 1.1rem;  font-weight: 600; margin: 0.5rem 0 0.25rem; }
//         .doc-editor p  { margin: 0.2rem 0; line-height: 1.65; }
//         .doc-editor ul { list-style: disc;    padding-left: 1.4rem; margin: 0.3rem 0; }
//         .doc-editor ol { list-style: decimal; padding-left: 1.4rem; margin: 0.3rem 0; }
//         .doc-editor li { margin: 0.1rem 0; line-height: 1.6; }
//         .doc-editor blockquote { border-left: 3px solid var(--color-primary); padding-left: 0.85rem; margin: 0.5rem 0; color: var(--color-muted); font-style: italic; }
//         .doc-editor a    { color: var(--color-primary); text-decoration: underline; }
//         .doc-editor hr   { border: none; border-top: 1px solid var(--color-border); margin: 0.8rem 0; }
//         .doc-editor code { font-family: monospace; font-size: 0.85em; background: var(--color-border); border-radius: 3px; padding: 0.1em 0.35em; }
//         .doc-editor pre  { background: var(--color-border); border-radius: 6px; padding: 0.75rem 1rem; margin: 0.5rem 0; overflow-x: auto; font-family: monospace; font-size: 0.85em; }
//       `}</style>
//     </div>
//   );
// }

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { jsPDF } from "jspdf";

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
      .replace(/_([^_\s][^_]*)_/g, "<em>$1</em>")
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
      out.push("<p><br></p>");
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
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(proc).join("");
    switch (tag) {
      case "b":
      case "strong":
        return `**${inner}**`;
      case "i":
      case "em":
        return `*${inner}*`;
      case "s":
      case "del":
        return `~~${inner}~~`;
      case "code":
        return `\`${inner}\``;
      case "pre":
        return `\`\`\`\n${inner}\n\`\`\`\n`;
      case "h1":
        return `# ${inner}\n`;
      case "h2":
        return `## ${inner}\n`;
      case "h3":
        return `### ${inner}\n`;
      case "p":
      case "div": {
        const content = inner.trim();
        return content ? `${content}\n` : "\n"; // prazna vrstica → \n, vsebina → content\n
      }
      case "br":
        return "\n";
      case "ul":
        return (
          Array.from(el.children)
            .map((li) => `- ${proc(li)}`)
            .join("\n") + "\n"
        );
      case "ol":
        return (
          Array.from(el.children)
            .map((li, i) => `${i + 1}. ${proc(li)}`)
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
      case "a":
        return `[${inner}](${el.getAttribute("href") ?? ""})`;
      case "hr":
        return "\n---\n";
      default:
        return inner;
    }
  }
  return proc(div).trim();
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
    return BLOCK.has(tag) ? inner.trimEnd() + "\n" : inner;
  }
  return proc(div)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── PDF export ───────────────────────────────────────────────────────────────
type Seg = { t: string; b: boolean; it: boolean };

function getSegs(node: Node, b = false, it = false): Seg[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? "";
    return t ? [{ t, b, it }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const nb = b || tag === "b" || tag === "strong";
  const nit = it || tag === "i" || tag === "em";
  return Array.from(el.childNodes).flatMap((c) => getSegs(c, nb, nit));
}

function exportHtmlToPdf(editorEl: HTMLElement) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ML = 50;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const CW = PW - ML * 2;
  let y = ML;

  const guard = (h: number) => {
    if (y + h > PH - ML) {
      doc.addPage();
      y = ML;
    }
  };

  const setStyle = (seg: Seg, fs: number) => {
    doc.setFontSize(fs);
    doc.setFont(
      "helvetica",
      seg.b && seg.it
        ? "bolditalic"
        : seg.b
          ? "bold"
          : seg.it
            ? "italic"
            : "normal",
    );
  };

  // Render segs with word-wrap. Starts at current y. Advances y.
  function renderSegs(ss: Seg[], fs: number, lh: number, x: number, w: number) {
    // Tokenise into word-chunks (word + trailing space kept together)
    const tokens: Seg[] = [];
    for (const s of ss) {
      const parts = s.t.match(/\S+\s*/g) ?? (s.t ? [s.t] : []);
      parts.forEach((p) => tokens.push({ t: p, b: s.b, it: s.it }));
    }
    if (!tokens.length) return;

    let line: Seg[] = [];
    let lw = 0;

    const flush = () => {
      if (!line.length) return;
      guard(lh);
      let cx = x;
      for (const seg of line) {
        setStyle(seg, fs);
        doc.text(seg.t, cx, y);
        cx += doc.getTextWidth(seg.t);
      }
      y += lh;
      line = [];
      lw = 0;
    };

    for (const tok of tokens) {
      setStyle(tok, fs);
      const tw = doc.getTextWidth(tok.t);
      if (lw > 0 && lw + tw > w) flush();
      // merge adjacent same-style tokens
      const prev = line[line.length - 1];
      if (prev && prev.b === tok.b && prev.it === tok.it) {
        prev.t += tok.t;
      } else {
        line.push({ ...tok });
      }
      lw += tw;
    }
    flush();
  }

  // Process each direct child of the editor — including bare text nodes
  for (const child of Array.from(editorEl.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        guard(16);
        renderSegs([{ t: text, b: false, it: false }], 11, 15, ML, CW);
        y += 3;
      }
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const ss = getSegs(el);
    const txt = ss
      .map((s) => s.t)
      .join("")
      .trim();

    if (tag === "h1") {
      guard(30);
      renderSegs(getSegs(el, true), 20, 26, ML, CW);
      y += 6;
    } else if (tag === "h2") {
      guard(25);
      renderSegs(getSegs(el, true), 16, 22, ML, CW);
      y += 4;
    } else if (tag === "h3") {
      guard(20);
      renderSegs(getSegs(el, true), 13, 18, ML, CW);
      y += 3;
    } else if (tag === "p" || tag === "div") {
      if (!txt) {
        y += 7;
        continue;
      }
      guard(16);
      renderSegs(ss, 11, 15, ML, CW);
      y += 3;
    } else if (tag === "ul" || tag === "ol") {
      for (let i = 0; i < el.children.length; i++) {
        const li = el.children[i] as HTMLElement;
        const bullet = tag === "ul" ? "• " : `${i + 1}. `;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const bw = doc.getTextWidth(bullet);
        guard(16);
        doc.text(bullet, ML, y);
        const liSegs = getSegs(li);
        if (liSegs.length) {
          const savedY = y;
          renderSegs(liSegs, 11, 15, ML + bw, CW - bw);
          // if renderSegs didn't advance y (empty), do it manually
          if (y === savedY) y += 15;
        } else {
          y += 15;
        }
      }
      y += 4;
    } else if (tag === "blockquote") {
      guard(16);
      const startY = y;
      renderSegs(getSegs(el, false, true), 11, 15, ML + 10, CW - 10);
      doc.setDrawColor(91, 141, 239);
      doc.line(ML + 3, startY - 10, ML + 3, y - 2);
      doc.setDrawColor(0, 0, 0);
      y += 4;
    } else if (tag === "hr") {
      guard(12);
      doc.setDrawColor(180, 180, 180);
      doc.line(ML, y, PW - ML, y);
      doc.setDrawColor(0, 0, 0);
      y += 10;
    }
  }

  doc.save("documentation.pdf");
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
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
        setInitialHtml(html);
      } catch {
        setError("Server connection error.");
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [projectId]);

  // Set editor content after loading completes (editorRef is null during loading spinner)
  useEffect(() => {
    if (!loading && initialHtml !== null && editorRef.current)
      editorRef.current.innerHTML = initialHtml;
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
    refreshFormats();
  }

  function refreshFormats() {
    const f = new Set<string>();
    [
      "bold",
      "italic",
      "strikeThrough",
      "insertUnorderedList",
      "insertOrderedList",
    ].forEach((cmd) => {
      try {
        if (document.queryCommandState(cmd)) f.add(cmd);
      } catch {}
    });
    setActiveFormats(f);
  }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  }

  function dl(content: string, name: string, mime: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    a.click();
    setExportOpen(false);
  }

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
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/projects/${projectId}/documentation/import`,
        { method: "POST", body: fd },
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
              .split(/\n\n+/)
              .map((b: string) => `<p>${b.replace(/\n/g, "<br>")}</p>`)
              .join("");
      htmlRef.current = html;
      if (editorRef.current) editorRef.current.innerHTML = html;
      await saveDoc(html);
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
        <span className="text-sm">Loading documentation...</span>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col" style={{ height: "100%" }}>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-shrink-0">
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
            {importing ? "Importing..." : "Import"}
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
                  {
                    label: "Markdown (.md)",
                    fn: () =>
                      dl(
                        htmlToMarkdown(htmlRef.current),
                        "documentation.md",
                        "text/markdown;charset=utf-8",
                      ),
                  },
                  {
                    label: "Plain text (.txt)",
                    fn: () =>
                      dl(
                        htmlToText(htmlRef.current),
                        "documentation.txt",
                        "text/plain;charset=utf-8",
                      ),
                  },
                  {
                    label: "PDF (.pdf)",
                    fn: () => {
                      if (editorRef.current) exportHtmlToPdf(editorRef.current);
                      setExportOpen(false);
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.fn}
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

      {/* Status */}
      <div className="h-5 mb-2 flex-shrink-0">
        {saving && <p className="text-xs text-muted">Saving...</p>}
        {success && !saving && (
          <p className="text-xs text-green-600">{success}</p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      {/* Editor */}
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
            title="Heading 1"
            onClick={() => exec("formatBlock", "h1")}
          >
            <span className="text-xs font-bold">H1</span>
          </ToolbarBtn>
          <ToolbarBtn
            title="Heading 2"
            onClick={() => exec("formatBlock", "h2")}
          >
            <span className="text-xs font-bold">H2</span>
          </ToolbarBtn>
          <ToolbarBtn
            title="Heading 3"
            onClick={() => exec("formatBlock", "h3")}
          >
            <span className="text-xs font-bold">H3</span>
          </ToolbarBtn>
          <ToolbarBtn
            title="Paragraph"
            onClick={() => exec("formatBlock", "p")}
          >
            <span className="text-xs">¶</span>
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            title="Bold"
            onClick={() => exec("bold")}
            active={activeFormats.has("bold")}
          >
            <span className="font-bold">B</span>
          </ToolbarBtn>
          <ToolbarBtn
            title="Italic"
            onClick={() => exec("italic")}
            active={activeFormats.has("italic")}
          >
            <span className="italic">I</span>
          </ToolbarBtn>
          <ToolbarBtn
            title="Strikethrough"
            onClick={() => exec("strikeThrough")}
            active={activeFormats.has("strikeThrough")}
          >
            <span className="line-through">S</span>
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            title="Bulleted list"
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
            title="Numbered list"
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
            title="Blockquote"
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
            title="Horizontal rule"
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
            title="Insert link"
            onClick={() => {
              const u = prompt("URL:");
              if (u) exec("createLink", u);
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
            title="Remove formatting"
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

        {/* Contenteditable */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={refreshFormats}
          onMouseUp={refreshFormats}
          onSelect={refreshFormats}
          data-placeholder="Start writing your project documentation here..."
          className="flex-1 p-4 text-sm focus:outline-none doc-editor"
          style={{
            color: "var(--color-foreground)",
            background: "var(--color-surface)",
            overflowY: "auto",
            minHeight: 0,
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
