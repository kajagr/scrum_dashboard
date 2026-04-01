"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useImperativeHandle, forwardRef } from "react";

export interface RichTextEditorRef {
  clearContent: () => void;
  isEmpty: () => boolean;
}

interface RichTextEditorProps {
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-colors
        ${active ? "bg-primary text-white" : "text-muted hover:bg-background hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ onChange, placeholder = "Write something...", minHeight = "80px" }, ref) => {
    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder }),
      ],
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: "outline-none text-sm text-foreground leading-relaxed",
          style: `min-height: ${minHeight}`,
        },
      },
    });

    useImperativeHandle(ref, () => ({
      clearContent: () => {
        editor?.commands.clearContent(true);
      },
      isEmpty: () => {
        return !editor || editor.isEmpty;
      },
    }));

    if (!editor) return null;

    return (
      <div className="rounded-xl border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 transition-all overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
            <span className="line-through">S</span>
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">
            H
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 113.256 1.508l-2.442 2.617h3.508m-3.526 0H2.99m6.543 0h1.125" />
            </svg>
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div className="px-3 py-2.5">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
export default RichTextEditor;