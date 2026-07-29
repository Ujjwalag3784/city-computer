import "server-only";
import { db } from "@/server/db";

export interface PublicFaqItem {
  question: string;
  answer: string;
  category: string | null;
}

/** `/faq` (docs/17 Phase 10). Product/category-scoped FAQs aren't surfaced on those pages yet — see `admin/faqs.ts`'s own doc comment for why; this returns the full general list only. */
export async function listPublicFaqs(): Promise<PublicFaqItem[]> {
  const faqs = await db.faq.findMany({
    where: { isActive: true, productId: null, categoryId: null },
    orderBy: { position: "asc" },
  });
  return faqs.map((f) => ({ question: f.question, answer: f.answer, category: f.category }));
}
