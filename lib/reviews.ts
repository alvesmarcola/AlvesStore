import { z } from "zod";

export const reviewStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const reviewSubmissionSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  cidade: z.string().trim().min(2).max(80),
  produto: z.string().trim().max(120).optional().default("Avaliação geral"),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().trim().min(8).max(500),
  website: z.string().max(200).optional().default(""),
}).strict();

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;

export function sanitizeReviewText(value: string) {
  return value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPublicReview(review: { status?: unknown }): boolean {
  return review.status === "approved";
}

export function filterPublicReviews<T extends { status?: unknown }>(reviews: T[]): T[] {
  return reviews.filter(isPublicReview);
}

export function publicReviewsPayload<T extends { status?: unknown }>(
  rows: T[],
  total: number,
  average: number,
  page: number,
  pageSize: number,
) {
  const reviews = filterPublicReviews(rows);
  return {
    reviews,
    total,
    average,
    hasMore: (page + 1) * pageSize < total,
  };
}
