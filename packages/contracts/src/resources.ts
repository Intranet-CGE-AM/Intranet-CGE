import { z } from "zod";
import { publicationAudienceSchema } from "./communications.js";
export const resourceTypeSchema = z.enum([
  "policy",
  "manual",
  "form",
  "external_link",
]);
export const resourceInputSchema = z
  .strictObject({
    type: resourceTypeSchema,
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(3).max(500),
    category: z.string().trim().min(2).max(80),
    responsibleName: z.string().trim().min(3).max(160),
    validFrom: z.iso.date(),
    validUntil: z.iso.date(),
    audience: publicationAudienceSchema,
    requiresAcknowledgment: z.boolean(),
    externalUrl: z
      .url({ protocol: /^https$/ })
      .max(2000)
      .nullable(),
  })
  .refine((input) => input.validUntil >= input.validFrom, {
    path: ["validUntil"],
    message: "O fim da vigência deve ser igual ou posterior ao início.",
  });
export const resourceSchema = z.object({
  ...resourceInputSchema.shape,
  fileSize: z.number().int().positive().nullable(),
  id: z.uuid(),
  rootId: z.uuid(),
  supersededById: z.uuid().nullable(),
  acknowledgedAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
  status: z.enum(["published", "superseded", "archived"]),
  authorAccountId: z.uuid(),
  authorName: z.string(),
  createdAt: z.iso.datetime(),
});
export const resourceListSchema = z.object({
  resources: z.array(resourceSchema),
  hasMore: z.boolean(),
});
export type Resource = z.infer<typeof resourceSchema>;
export type ResourceInput = z.infer<typeof resourceInputSchema>;
export type ResourceList = z.infer<typeof resourceListSchema>;
