import { z } from "zod";

export const hrMetricsQuerySchema = z
  .strictObject({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    unitId: z.uuid().optional(),
  })
  .refine(
    ({ startDate, endDate }) =>
      endDate >= startDate &&
      Date.parse(endDate) - Date.parse(startDate) < 366 * 86400000,
    { message: "Informe um período válido de até 366 dias." },
  );
const count = z.number().int().nonnegative();
const states = z.array(z.object({ status: z.string(), count }));
export const hrMetricsSchema = z.object({
  units: z.array(z.object({ id: z.uuid(), name: z.string() })),
  requests: z
    .array(z.object({ type: z.string(), status: z.string(), count }))
    .nullable(),
  completion: z
    .object({ count, averageHours: z.number().nonnegative().nullable() })
    .nullable(),
  occurrences: states.nullable(),
  vacations: states.nullable(),
  trainingPending: count.nullable(),
  divergences: count.nullable(),
});
export type HrMetrics = z.infer<typeof hrMetricsSchema>;
