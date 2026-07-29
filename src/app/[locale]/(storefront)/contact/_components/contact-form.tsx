"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactFormAction } from "../_actions";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setIssues({});
    try {
      const result = await submitContactFormAction({ name, email, phone, message, companyWebsite });
      if (!result.ok) {
        const fieldIssues: Record<string, string> = {};
        for (const issue of result.issues ?? []) fieldIssues[issue.field] = issue.message;
        setIssues(fieldIssues);
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p className="text-body-md text-on-surface">
        Thanks — we&apos;ve got your message and will get back to you soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-name">Your name</Label>
        <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} required />
        {issues.name && <p className="text-body-sm text-danger">{issues.name}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {issues.email && <p className="text-body-sm text-danger">{issues.email}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-phone">Phone</Label>
          <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        {issues.message && <p className="text-body-sm text-danger">{issues.message}</p>}
      </div>
      {/* Honeypot — hidden from real visitors via CSS, never via `type="hidden"` (some bots skip those), and off-screen rather than `display:none` (some bots check computed visibility). */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <Label htmlFor="contact-company-website">Company website</Label>
        <Input
          id="contact-company-website"
          tabIndex={-1}
          autoComplete="off"
          value={companyWebsite}
          onChange={(e) => setCompanyWebsite(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
