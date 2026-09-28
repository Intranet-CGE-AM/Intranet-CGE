import { z } from "zod";
import { delegationSchema } from "./substitutions.js";

export const inboxTypeSchema = z.enum([
  "request",
  "vacation",
  "occurrence",
  "training",
  "checklist",
]);
export const inboxQuerySchema = z.strictObject({
  type: inboxTypeSchema.optional(),
  unitId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50),
});
export const inboxItemSchema = z.object({
  delegation: delegationSchema.optional(),
  id: z.string(),
  type: inboxTypeSchema,
  title: z.string(),
  context: z.string(),
  unitId: z.uuid(),
  unitName: z.string(),
  createdAt: z.date(),
  dueAt: z.date().nullable(),
  priority: z.enum(["urgent", "normal"]),
  href: z.string().startsWith("/rh/"),
});
export const inboxSchema = z.object({
  items: z.array(inboxItemSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  sourcesUnavailable: z.array(inboxTypeSchema),
  units: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type InboxItem = z.infer<typeof inboxItemSchema>;
export type Inbox = z.infer<typeof inboxSchema>;
