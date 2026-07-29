import { z } from "zod";

export const faqFormSchema = z.object({
  question: z.string().trim().min(3, "Enter the question."),
  answer: z.string().trim().min(3, "Enter the answer."),
  category: z.string().trim().optional(),
  isActive: z.boolean().default(true),
});
export type FaqFormInput = z.infer<typeof faqFormSchema>;

export const moveFaqSchema = z.object({
  faqId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});
