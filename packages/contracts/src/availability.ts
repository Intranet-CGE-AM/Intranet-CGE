import { z } from "zod";

export const availabilityQuerySchema = z
  .strictObject({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    unitId: z.uuid().optional(),
  })
  .refine(
    ({ startDate, endDate }) => {
      const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
      return days >= 0 && days < 92;
    },
    {
      message:
        "Informe um período de até 92 dias, com fim igual ou posterior ao início.",
    },
  );

export const teamAvailabilitySchema = z.object({
  units: z.array(z.object({ id: z.uuid(), name: z.string() })),
  members: z.array(
    z.object({
      employmentId: z.uuid(),
      personId: z.uuid(),
      name: z.string(),
      unitId: z.uuid(),
      unitName: z.string(),
      jobTitle: z.string().nullable(),
      alerts: z.array(z.string()),
    }),
  ),
  absences: z.array(
    z.object({
      id: z.uuid(),
      employmentId: z.uuid(),
      name: z.string(),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      reason: z.string(),
    }),
  ),
  pending: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      kind: z.enum(["vacation", "occurrence"]),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
    }),
  ),
});
export type TeamAvailability = z.infer<typeof teamAvailabilitySchema>;
