"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeoPreview } from "@/components/admin/seo-preview";
import { TiptapEditor } from "@/components/admin/tiptap-editor";
// `enums`, not `client` — `client.ts` drags the Prisma Node runtime into the client bundle.
import { PostStatus } from "@/generated/prisma/enums";
import { slugify } from "@/lib/slug";
import { createPostAction, updatePostAction, deletePostAction } from "../_actions";

export interface PostFormAuthorOption {
  id: string;
  name: string;
}

export interface PostFormValues {
  title: string;
  slug: string;
  excerpt: string;
  content: unknown;
  authorId: string;
  status: PostStatus;
  categorySlugsText: string;
  tagsText: string;
  relatedProductSlugsText: string;
  coverMediaId: string;
  metaTitle: string;
  metaDescription: string;
}

export const EMPTY_POST_FORM: PostFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  authorId: "",
  status: PostStatus.DRAFT,
  categorySlugsText: "",
  tagsText: "",
  relatedProductSlugsText: "",
  coverMediaId: "",
  metaTitle: "",
  metaDescription: "",
};

export interface PostFormProps {
  postId?: string;
  initialValues: PostFormValues;
  authors: PostFormAuthorOption[];
}

/**
 * Add/edit form for a blog post — docs/17 Phase 10. Category/tag/related-
 * product assignment reuses the same "comma-separated codes, a picker is
 * coming later" simplification `admin/coupons`'s `CouponForm` already
 * established for this codebase (see that file's own doc comment) rather
 * than inventing a second convention for the same kind of gap.
 */
export function PostForm({ postId, initialValues, authors }: PostFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<PostFormValues>(initialValues);
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleTitleChange(title: string) {
    update("title", title);
    if (!slugTouched) update("slug", slugify(title));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setIssues({});
    try {
      const payload = {
        title: values.title,
        slug: values.slug,
        excerpt: values.excerpt || undefined,
        content: values.content,
        authorId: values.authorId,
        status: values.status,
        categorySlugsText: values.categorySlugsText || undefined,
        tagsText: values.tagsText || undefined,
        relatedProductSlugsText: values.relatedProductSlugsText || undefined,
        coverMediaId: values.coverMediaId || undefined,
        metaTitle: values.metaTitle || undefined,
        metaDescription: values.metaDescription || undefined,
      };

      const result = postId
        ? await updatePostAction(postId, payload)
        : await createPostAction(payload);

      if (!result.ok) {
        const fieldIssues: Record<string, string> = {};
        for (const issue of result.issues ?? []) fieldIssues[issue.field] = issue.message;
        setIssues(fieldIssues);
        toast(result.message ?? "Couldn't save this post. Please check the form.");
        return;
      }

      toast(postId ? "Post saved." : "Post created.");
      router.push("/admin/blog");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!postId) return;
    if (!window.confirm("Delete this post? It will no longer be visible anywhere.")) return;
    setSubmitting(true);
    try {
      const result = await deletePostAction(postId);
      if (!result.ok) {
        toast(result.message ?? "Couldn't delete this post.");
        return;
      }
      toast("Post deleted.");
      router.push("/admin/blog");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-title">Title</Label>
        <Input
          id="post-title"
          value={values.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. How to choose a gaming laptop in Nepal"
          required
        />
        {issues.title && <p className="text-body-sm text-danger">{issues.title}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-slug">URL slug</Label>
        <Input
          id="post-slug"
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true);
            update("slug", e.target.value);
          }}
          placeholder="how-to-choose-a-gaming-laptop"
          required
        />
        <p className="text-body-sm text-on-surface-variant">
          Will be published at citycomputer.com.np/blog/{values.slug || "..."}
        </p>
        {issues.slug && <p className="text-body-sm text-danger">{issues.slug}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-excerpt">Short summary</Label>
        <Textarea
          id="post-excerpt"
          value={values.excerpt}
          onChange={(e) => update("excerpt", e.target.value)}
          placeholder="One or two sentences shown in the blog list."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-author">Author</Label>
        <Select value={values.authorId} onValueChange={(v) => update("authorId", v)}>
          <SelectTrigger id="post-author">
            <SelectValue placeholder="Choose an author" />
          </SelectTrigger>
          <SelectContent>
            {authors.map((author) => (
              <SelectItem key={author.id} value={author.id}>
                {author.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-body-sm text-on-surface-variant">
          No author yet? Add one from{" "}
          <Link href="/admin/blog/authors" className="underline">
            Authors
          </Link>{" "}
          first.
        </p>
        {issues.authorId && <p className="text-body-sm text-danger">{issues.authorId}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Content</Label>
        <TiptapEditor value={values.content} onChange={(doc) => update("content", doc)} />
        {issues.content && <p className="text-body-sm text-danger">{issues.content}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-status">Status</Label>
        <Select value={values.status} onValueChange={(v) => update("status", v as PostStatus)}>
          <SelectTrigger id="post-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PostStatus.DRAFT}>Draft — only visible to staff</SelectItem>
            <SelectItem value={PostStatus.PUBLISHED}>Published — live on the website</SelectItem>
            <SelectItem value={PostStatus.ARCHIVED}>
              Archived — hidden, kept for reference
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-categories">Categories</Label>
        <Input
          id="post-categories"
          value={values.categorySlugsText}
          onChange={(e) => update("categorySlugsText", e.target.value)}
          placeholder="laptops, components"
        />
        <p className="text-body-sm text-on-surface-variant">
          Category codes (URL slugs), separated by commas — ask a developer if unsure.
        </p>
        {issues.categorySlugsText && (
          <p className="text-body-sm text-danger">{issues.categorySlugsText}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-tags">Tags</Label>
        <Input
          id="post-tags"
          value={values.tagsText}
          onChange={(e) => update("tagsText", e.target.value)}
          placeholder="gaming, buying-guide"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-related-products">Related products</Label>
        <Input
          id="post-related-products"
          value={values.relatedProductSlugsText}
          onChange={(e) => update("relatedProductSlugsText", e.target.value)}
          placeholder="hp-victus-15, asus-tuf-a15"
        />
        <p className="text-body-sm text-on-surface-variant">
          Product URL slugs, separated by commas. Shown as &ldquo;Related products&rdquo; at the
          bottom of the post.
        </p>
        {issues.relatedProductSlugsText && (
          <p className="text-body-sm text-danger">{issues.relatedProductSlugsText}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Search information</Label>
        {/*
          docs/11-SEO-STRATEGY.md §6.5's thin-content guard applies to blog
          posts too (thin-content.ts) but is silent on a search-preview
          requirement per entity type — Phase 11 wires the same
          `SeoPreview` the product wizard already uses here rather than the
          bare, un-guided `<Input>`s this form previously had (see
          PROGRESS.md Phase 11's admin-SEO-fields audit note).
        */}
        <SeoPreview
          pageUrl={`citycomputer.com.np/blog/${values.slug || "..."}`}
          pageTitle={values.metaTitle}
          onPageTitleChange={(metaTitle) => update("metaTitle", metaTitle)}
          searchDescription={values.metaDescription}
          onSearchDescriptionChange={(metaDescription) =>
            update("metaDescription", metaDescription)
          }
          productNameForHint={values.title}
        />
        {issues.metaTitle && <p className="text-body-sm text-danger">{issues.metaTitle}</p>}
        {issues.metaDescription && (
          <p className="text-body-sm text-danger">{issues.metaDescription}</p>
        )}
      </div>

      <div className="flex justify-between gap-3">
        {postId ? (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting}>
            Delete post
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/blog")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : postId ? "Save changes" : "Create post"}
          </Button>
        </div>
      </div>
    </form>
  );
}
