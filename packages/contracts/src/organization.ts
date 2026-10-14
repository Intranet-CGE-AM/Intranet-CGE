import { z } from "zod";

export const positionInputSchema = z.strictObject({
  unitId: z.uuid(),
  code: z.string().trim().min(1).max(30).toUpperCase(),
  title: z.string().trim().min(2).max(160),
  plannedCount: z.number().int().min(0).max(2147483647),
  active: z.boolean(),
});
export const positionSchema = positionInputSchema.extend({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const organizationSchema = z.object({
  units: z.array(
    z.object({
      id: z.uuid(),
      code: z.string(),
      name: z.string(),
      active: z.boolean(),
      parentId: z.uuid().nullable(),
      parentOutsideScope: z.boolean(),
      canManage: z.boolean(),
      chiefs: z.array(z.object({ personId: z.uuid(), name: z.string() })),
      peopleCount: z.number().int().nonnegative(),
      positions: z.array(
        positionSchema.extend({
          occupiedCount: z.number().int().nonnegative(),
          vacancies: z.number().int(),
        }),
      ),
      employments: z.array(
        z.object({
          id: z.uuid(),
          personId: z.uuid(),
          name: z.string(),
          jobTitle: z.string().nullable(),
          positionId: z.uuid().nullable(),
          version: z.number().int().positive(),
        }),
      ),
    }),
  ),
});
export type Organization = z.infer<typeof organizationSchema>;
export type PositionInput = z.infer<typeof positionInputSchema>;
