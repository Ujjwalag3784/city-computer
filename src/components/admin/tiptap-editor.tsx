"use client";

/**
 * The admin rich-text editor for blog posts and CMS pages (docs/17 Phase
 * 10: "Tiptap editor"). Wired to `@tiptap/react` + `@tiptap/starter-kit` +
 * `@tiptap/extension-link` — installed as a dependency since before this
 * pass but unused anywhere in the codebase until now.
 *
 * The editor's `onChange` always hands the caller `editor.getJSON()` (a
 * plain object matching Tiptap's own JSON schema), never HTML — `getHTML()`
 * is never called anywhere in this file. The caller (the post/page form)
 * is responsible for round-tripping that JSON through
 * `parseTiptapDocument` server-side before it's ever saved — this
 * component's own job is only to produce well-formed Tiptap JSON in the
 * first place, restricted to the same node/mark set `src/lib/tiptap/
 * schema.ts` allow-lists (StarterKit's default extension set plus a link
 * mark) so what an editor produces and what the server accepts stay in
 * sync by construction, not by convention.
 */
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TiptapEditorProps {
  value: unknown;
  onChange: (doc: unknown) => void;
  className?: string;
}

function ToolbarButton({
  onClick,
  active,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "outline" : "ghost"}
      size="sm"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

/** A safe empty Tiptap document — used when `value` isn't already a valid doc (e.g. a brand-new post). */
const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function TiptapEditor({ value, onChange, className }: TiptapEditorProps) {
  const editor = useEditor({
    // `@tiptap/starter-kit` v3 already bundles the link mark (see its own
    // `LinkOptions` re-export) — configuring it here rather than adding a
    // second, separate `@tiptap/extension-link` instance avoids a
    // duplicate-extension-name conflict. The standalone `@tiptap/
    // extension-link` package stays a dependency for its exported types
    // only.
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: { openOnClick: false, autolink: false },
      }),
    ],
    content: value && typeof value === "object" ? value : EMPTY_DOC,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    editorProps: {
      attributes: {
        class: "prose-sm min-h-[300px] max-w-none focus:outline-none",
      },
    },
  });

  // Keep the editor in sync if `value` changes from outside (e.g. loading a
  // different post) without fighting the user's own typing — only resets
  // when the editor doesn't already have focus.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = value && typeof value === "object" ? value : EMPTY_DOC;
    editor.commands.setContent(next as never, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the editor instance itself changes; `value` changes are intentionally not tracked here to avoid fighting live typing.
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[340px] rounded-lg border border-glass-stroke bg-surface-container-low" />
    );
  }

  function setLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    // A plain `window.prompt` — admin-only editing tool, not customer-facing; a real link dialog is a follow-up UI polish item.
    const url = window.prompt("Link URL (https:// or /pages/...)", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className={cn("rounded-lg border border-glass-stroke", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-glass-stroke p-2">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          S
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          Code
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
          Link
        </ToolbarButton>
      </div>
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
