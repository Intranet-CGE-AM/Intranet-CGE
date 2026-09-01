import { z } from "zod";

/* =========================================================
 * STATUS
 * ======================================================= */

export const visitorConfirmationStatusSchema =
  z.enum([
    "not_sent",
    "pending",
    "confirmed",
    "declined",
    "expired",
  ]);

/* =========================================================
 * RESPOSTA DO VISITANTE
 * ======================================================= */

export const visitorConfirmationResponseSchema =
  z.object({
    response: z.enum([
      "confirmed",
      "declined",
    ]),
  });

/* =========================================================
 * DADOS PÚBLICOS DO CONVITE
 * ======================================================= */

export const publicVisitConfirmationSchema =
  z.object({
    visitorName: z.string(),

    organization: z.string(),

    protocol: z.string(),

    subject: z.string(),

    scheduledDate: z.string(),

    startTime: z.string(),

    endTime: z.string(),

    location: z.string(),

    status:
      visitorConfirmationStatusSchema,
  });

/* =========================================================
 * TYPES
 * ======================================================= */

export type VisitorConfirmationStatus =
  z.infer<
    typeof visitorConfirmationStatusSchema
  >;

export type VisitorConfirmationResponse =
  z.infer<
    typeof visitorConfirmationResponseSchema
  >;

export type PublicVisitConfirmation =
  z.infer<
    typeof publicVisitConfirmationSchema
  >;