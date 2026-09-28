import { z } from "zod";

const audienceIds = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "Não repita públicos.");
export const publicationAudienceSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("all") }),
  z.strictObject({ type: z.literal("units"), ids: audienceIds }),
  z.strictObject({ type: z.literal("categories"), ids: audienceIds }),
]);
export type PublicationAudience = z.infer<typeof publicationAudienceSchema>;
export const communicationInputSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(3).max(500),
    body: z.string().trim().min(1).max(20000),
    publicationAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    audience: publicationAudienceSchema,
    requiresAcknowledgment: z.boolean(),
  })
  .refine(
    (input) => new Date(input.expiresAt) > new Date(input.publicationAt),
    {
      path: ["expiresAt"],
      message: "A expiração deve ser posterior à publicação.",
    },
  );
export const communicationSchema = communicationInputSchema.safeExtend({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "scheduled", "published", "archived"]),
  authorAccountId: z.uuid(),
  authorName: z.string(),
  bodyHtml: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  acknowledgedAt: z.iso.datetime().nullable(),
});
export const communicationSummarySchema = z
  .object(communicationSchema.shape)
  .omit({ body: true, bodyHtml: true });
export const communicationListSchema = z.object({
  communications: z.array(communicationSummarySchema),
  hasMore: z.boolean(),
});
export type Communication = z.infer<typeof communicationSchema>;
export type CommunicationInput = z.infer<typeof communicationInputSchema>;
export type CommunicationList = z.infer<typeof communicationListSchema>;
