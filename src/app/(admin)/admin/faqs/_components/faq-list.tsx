"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminFaqItem } from "@/server/services/admin/faqs";
import { createFaqAction, updateFaqAction, deleteFaqAction, moveFaqAction } from "../_actions";

function FaqRow({ faq, index, total }: { faq: AdminFaqItem; index: number; total: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const [isActive, setIsActive] = useState(faq.isActive);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const result = await updateFaqAction(faq.id, { question, answer, isActive });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save.");
        return;
      }
      toast("FAQ saved.");
      setEditing(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Remove this question?")) return;
    const result = await deleteFaqAction(faq.id);
    if (!result.ok) toast(result.message ?? "Couldn't remove this FAQ.");
    else router.refresh();
  }

  async function handleMove(direction: "up" | "down") {
    const result = await moveFaqAction({ faqId: faq.id, direction });
    if (!result.ok) toast(result.message ?? "Couldn't reorder.");
    else router.refresh();
  }

  if (editing) {
    return (
      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 py-4">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question"
          />
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer"
          />
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-body-sm text-on-surface-variant">Live</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={submitting}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded border border-glass-stroke px-3 py-2">
      <div>
        <p className="text-body-sm font-medium text-on-surface">{faq.question}</p>
        <p className="text-body-sm text-on-surface-variant">{faq.answer}</p>
        {!faq.isActive && <p className="text-body-sm text-on-surface-variant">(Hidden)</p>}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleMove("up")}
          disabled={index === 0}
        >
          ↑
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleMove("down")}
          disabled={index === total - 1}
        >
          ↓
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export function FaqList({ faqs }: { faqs: AdminFaqItem[] }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await createFaqAction({ question, answer, isActive: true });
      if (!result.ok) {
        toast(result.message ?? "Couldn't add this FAQ.");
        return;
      }
      toast("FAQ added.");
      setQuestion("");
      setAnswer("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {faqs.length === 0 && <p className="text-body-sm text-on-surface-variant">No FAQs yet.</p>}
        {faqs.map((faq, index) => (
          <FaqRow key={faq.id} faq={faq} index={index} total={faqs.length} />
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-glass-stroke pt-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faq-question">Question</Label>
          <Input
            id="faq-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faq-answer">Answer</Label>
          <Textarea
            id="faq-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Adding…" : "Add question"}
        </Button>
      </form>
    </div>
  );
}
