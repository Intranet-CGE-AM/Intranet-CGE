import { z } from "zod";
export const notificationSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  href: z.string().startsWith("/"),
  createdAt: z.date(),
  readAt: z.date().nullable(),
});
export const notificationPageSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int(),
  hasMore: z.boolean(),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;
