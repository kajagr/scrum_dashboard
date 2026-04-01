"use client";

import { useRef } from "react";
import RichTextEditor, { RichTextEditorRef } from "@/components/features/wall/RichTextEditor";

interface WallComposeProps {
  onSubmit: (content: string) => Promise<void>;
  posting: boolean;
  error: string | null;
}

export default function WallCompose({ onSubmit, posting, error }: WallComposeProps) {
  const editorRef = useRef<RichTextEditorRef>(null);
  const contentRef = useRef<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentRef.current || editorRef.current?.isEmpty()) return;
    await onSubmit(contentRef.current);
    editorRef.current?.clearContent();
    contentRef.current = "";
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <RichTextEditor
          ref={editorRef}
          onChange={(html) => { contentRef.current = html; }}
          placeholder="Share an update with your team..."
          minHeight="80px"
        />
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-error-border bg-error-light">
            <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-error">{error}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-subtle">Cmd/Ctrl + Enter to post</p>
          <button
            type="submit"
            disabled={posting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover"
          >
            {posting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Posting...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Post
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}