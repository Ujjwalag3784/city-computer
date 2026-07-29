/**
 * Renders a validated `TiptapDocument` (see `schema.ts`) as real React
 * elements — never `dangerouslySetInnerHTML`. This is the ONLY sanctioned
 * way `Post.content`/`Page.content` (or their `PostTranslation`/
 * `PageTranslation` equivalents) are ever turned into markup anywhere in
 * this codebase.
 *
 * A Server Component (no `"use client"` needed — plain function
 * components returning JSX), so blog posts and CMS pages render fully
 * server-side and are indexable (docs/17 Phase 10 acceptance bar).
 *
 * Every node type here must already exist in `schema.ts`'s allow-list —
 * if `tiptapDocumentSchema` doesn't accept a shape, this file will never
 * see it, so there is no second gate to keep in sync beyond "don't add a
 * case here without first adding it to the schema" (and vice versa).
 */
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TiptapDocument } from "./schema";

type AnyNode = { type: string; [key: string]: unknown };

function renderMarks(text: string, marks: AnyNode[] | undefined, key: string): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((acc, mark, i) => {
    const markKey = `${key}-mark-${i}`;
    switch (mark.type) {
      case "bold":
        return <strong key={markKey}>{acc}</strong>;
      case "italic":
        return <em key={markKey}>{acc}</em>;
      case "underline":
        return (
          <span key={markKey} className="underline">
            {acc}
          </span>
        );
      case "strike":
        return (
          <span key={markKey} className="line-through">
            {acc}
          </span>
        );
      case "code":
        return (
          <code
            key={markKey}
            className="rounded bg-surface-container px-1 py-0.5 font-mono text-[0.9em]"
          >
            {acc}
          </code>
        );
      case "link": {
        const attrs = mark.attrs as { href: string; target?: string };
        const isExternal = /^https?:\/\//.test(attrs.href);
        return (
          <Link
            key={markKey}
            href={attrs.href}
            className="text-primary underline underline-offset-2 hover:no-underline"
            {...(isExternal ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}
          >
            {acc}
          </Link>
        );
      }
      default:
        return acc;
    }
  }, text);
}

function renderInline(nodes: AnyNode[] | undefined, keyPrefix: string): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    if (node.type === "text") {
      return (
        <span key={key}>{renderMarks(node.text as string, node.marks as AnyNode[], key)}</span>
      );
    }
    if (node.type === "hardBreak") return <br key={key} />;
    return null;
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-display-sm font-semibold",
  2: "text-headline-lg font-semibold",
  3: "text-headline-md font-semibold",
  4: "text-headline-sm font-semibold",
};

function renderBlock(node: AnyNode, key: string): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="text-body-lg leading-relaxed">
          {renderInline(node.content as AnyNode[], key)}
        </p>
      );
    case "heading": {
      const level = (node.attrs as { level: number }).level;
      const Tag = `h${level}` as unknown as "h1" | "h2" | "h3" | "h4";
      // `level` is constrained to 1-4 by `tiptapDocumentSchema`'s `heading` attrs before this ever renders — never arbitrary input.
      // eslint-disable-next-line security/detect-object-injection
      const headingClass = HEADING_CLASS[level] ?? HEADING_CLASS[4];
      return (
        <Tag key={key} className={cn(headingClass, "mt-2")}>
          {renderInline(node.content as AnyNode[], key)}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="border-l-4 border-outline-variant pl-4 italic text-on-surface-variant"
        >
          {(node.content as AnyNode[] | undefined)?.map((child, i) =>
            renderBlock(child, `${key}-${i}`),
          )}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-lg bg-surface-container p-4 font-mono text-body-sm"
        >
          <code>
            {(node.content as AnyNode[] | undefined)?.map((t) => t.text as string).join("") ?? ""}
          </code>
        </pre>
      );
    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-6 text-body-lg">
          {(node.content as AnyNode[] | undefined)?.map((li, i) => (
            <li key={`${key}-${i}`}>
              {(li.content as AnyNode[] | undefined)?.map((child, j) =>
                renderBlock(child, `${key}-${i}-${j}`),
              )}
            </li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal space-y-1 pl-6 text-body-lg">
          {(node.content as AnyNode[] | undefined)?.map((li, i) => (
            <li key={`${key}-${i}`}>
              {(li.content as AnyNode[] | undefined)?.map((child, j) =>
                renderBlock(child, `${key}-${i}-${j}`),
              )}
            </li>
          ))}
        </ol>
      );
    case "horizontalRule":
      return <hr key={key} className="border-outline-variant" />;
    case "image": {
      const attrs = node.attrs as { src: string; alt?: string | null; title?: string | null };
      return (
        <span key={key} className="block overflow-hidden rounded-lg">
          {/* Unknown intrinsic size at content-authoring time — fill within an aspect box is the safe default for editor-inserted images. */}
          <span className="relative block aspect-video w-full">
            <Image
              src={attrs.src}
              alt={attrs.alt ?? ""}
              title={attrs.title ?? undefined}
              fill
              className="object-cover"
            />
          </span>
        </span>
      );
    }
    default:
      return null;
  }
}

/** Renders a full validated Tiptap document. Wrap in a `prose`-equivalent container at the call site for spacing between blocks (`space-y-4` recommended). */
export function TiptapContent({ doc, className }: { doc: TiptapDocument; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {doc.content.map((node, i) => renderBlock(node as AnyNode, `b-${i}`))}
    </div>
  );
}
