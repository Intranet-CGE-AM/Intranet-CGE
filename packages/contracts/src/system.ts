import { z } from "zod";

export const systemStatusSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
});

export type SystemStatus = z.infer<typeof systemStatusSchema>;
