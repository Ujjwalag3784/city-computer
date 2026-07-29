"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TiptapEditor } from "@/components/admin/tiptap-editor";
import { PageTemplate, PostStatus } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import { createPageAction, updatePageAction, deletePageAction } from "../_actions";

export interface PageFormValues {
  title: string;
  slug: string;
  content: unknown;
  template: PageTemplate;
  status: PostStatus;
  metaTitle: string;
  metaDescription: string;
}

export const EMPTY_PAGE_FORM: PageFormValues = {
  title: "",
  slug: "",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  template: PageTemplate.DEFAULT,
  status: PostStatus.DRAFT,
  metaTitle: "",
  metaDescription: "",
};

export interface PageFormProps {
  pageId?: string;
  initialValues: PageFormValues;
}

export function PageForm({ pageId, initialValues }: PageFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<PageFormValues>(initialValues);
  const [slugTouched, setSlugTouched] = useState(Boolean(pageId));
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof PageFormValues>(key: K, value: PageFormValues[K]) {
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
        content: values.content,
        template: values.template,
        status: values.status,
        metaTitle: values.metaTitle || undefined,
        metaDescription: values.metaDescription || undefined,
      };

      const result = pageId
        ? await updatePageAction(pageId, payload)
        : await createPageAction(payload);

      if (!result.ok) {
        const fieldIssues: Record<string, string> = {};
        for (const issue of result.issues ?? []) fieldIssues[issue.field] = issue.message;
        setIssues(fieldIssues);
        toast(result.message ?? "Couldn't save this page. Please check the form.");
        return;
      }

      toast(pageId ? "Page saved." : "Page created.");
      router.push("/admin/pages");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pageId) return;
    if (!window.confirm("Delete this page? Any menu items pointing to it will stop resolving."))
      return;
    setSubmitting(true);
    try {
      const result = await deletePageAction(pageId);
      if (!result.ok) {
        toast(result.message ?? "Couldn't delete this page.");
        return;
      }
      toast("Page deleted.");
      router.push("/admin/pages");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-title">Title</Label>
        <Input
          id="page-title"
          value={values.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          required
        />
        {issues.title && <p className="text-body-sm text-danger">{issues.title}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-slug">URL slug</Label>
        <Input
          id="page-slug"
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true);
            update("slug", e.target.value);
          }}
          required
        />
        <p className="text-body-sm text-on-surface-variant">
          Will be published at citycomputer.com.np/pages/{values.slug || "..."}
        </p>
        {issues.slug && <p className="text-body-sm text-danger">{issues.slug}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-template">Template</Label>
        <Select
          value={values.template}
          onValueChange={(v) => update("template", v as PageTemplate)}
        >
          <SelectTrigger id="page-template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PageTemplate.DEFAULT}>Default — narrow reading width</SelectItem>
            <SelectItem value={PageTemplate.FULL_WIDTH}>Full width</SelectItem>
            <SelectItem value={PageTemplate.POLICY}>Policy — for legal/policy pages</SelectItem>
            <SelectItem value={PageTemplate.LANDING}>Landing — no site chrome padding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Content</Label>
        <TiptapEditor value={values.content} onChange={(doc) => update("content", doc)} />
        {issues.content && <p className="text-body-sm text-danger">{issues.content}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-status">Status</Label>
        <Select value={values.status} onValueChange={(v) => update("status", v as PostStatus)}>
          <SelectTrigger id="page-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PostStatus.DRAFT}>Draft — only visible to staff</SelectItem>
            <SelectItem value={PostStatus.PUBLISHED}>Published — live on the website</SelectItem>
            <SelectItem value={PostStatus.ARCHIVED}>Archived — hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-meta-title">Search result title</Label>
          <Input
            id="page-meta-title"
            value={values.metaTitle}
            onChange={(e) => update("metaTitle", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-meta-description">Search result description</Label>
          <Input
            id="page-meta-description"
            value={values.metaDescription}
            onChange={(e) => update("metaDescription", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-between gap-3">
        {pageId ? (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting}>
            Delete page
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/pages")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : pageId ? "Save changes" : "Create page"}
          </Button>
        </div>
      </div>
    </form>
  );
}
