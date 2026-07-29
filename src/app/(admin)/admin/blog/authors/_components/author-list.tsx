"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminAuthorListItem } from "@/server/services/admin/blog";
import { createAuthorAction } from "../../_actions";

export function AuthorList({ authors }: { authors: AdminAuthorListItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await createAuthorAction({ name, bio: bio || undefined });
      if (!result.ok) {
        toast(result.message ?? "Couldn't add this author.");
        return;
      }
      toast("Author added.");
      setName("");
      setBio("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="author-name">Name</Label>
          <Input id="author-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="author-bio">Short bio</Label>
          <Textarea id="author-bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Adding…" : "Add author"}
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        {authors.length === 0 && (
          <p className="text-body-sm text-on-surface-variant">No authors yet — add one above.</p>
        )}
        {authors.map((author) => (
          <Card key={author.id} variant="surface">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-body-md text-on-surface">{author.name}</p>
                {author.bio && <p className="text-body-sm text-on-surface-variant">{author.bio}</p>}
              </div>
              <p className="text-body-sm text-on-surface-variant">
                {author.postCount} post{author.postCount === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
