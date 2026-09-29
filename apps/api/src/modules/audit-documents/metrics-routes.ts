import {
  authErrorSchema,
  auditDocumentMetricsQuerySchema,
  auditDocumentMetricsSchema,
  permissionAllows,
} from "@cge/contracts";
import { asc, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { recordAudit } from "../audit/service.js";
import { organizationUnits } from "../people/schema.js";
import {
  auditDocumentEvents as events,
  auditDocumentFiles as files,
  auditDocumentSettings,
  auditDocuments as documents,
} from "./schema.js";

type Stats = {
  count: number;
  averageHours: number | null;
  medianHours: number | null;
};
const hours = (from: string, to: string) =>
  sql.raw(`extract(epoch from (${to} - ${from})) / 3600`);
const stats = (value: ReturnType<typeof hours>, filter = sql`true`) => sql`
  count(*) filter (where ${filter})::int as count,
  avg(${value}) filter (where ${filter})::float8 as "averageHours",
  (percentile_cont(0.5) within group (order by ${value}) filter (where ${filter}))::float8 as "medianHours"`;
const date = (value: string | null) => (value ? new Date(value) : null);
const ratio = (part: number, whole: number) => (whole ? part / whole : null);

export const auditDocumentMetricsRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/api/audit-documents/metrics",
    {
      schema: {
        querystring: auditDocumentMetricsQuerySchema,
        response: { 200: auditDocumentMetricsSchema, 403: authErrorSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const key = "audit_documents.reports";
      const fail = (message: string) =>
        reply.code(403).send({ code: "FORBIDDEN", message });
      if (!permissionAllows(user.permissions, key))
        return fail("Você não possui acesso aos indicadores de auditoria.");
      const units = (
        await db
          .select({ id: organizationUnits.id, name: organizationUnits.name })
          .from(organizationUnits)
          .orderBy(asc(organizationUnits.name))
      ).filter((unit) => permissionAllows(user.permissions, key, unit.id));
      const { from, to, unitId } = request.query;
      if (unitId && !units.some((unit) => unit.id === unitId))
        return fail("Equipe fora do seu escopo.");
      const ids = unitId ? [unitId] : units.map((unit) => unit.id);
      // Datas administrativas de Manaus; limite superior exclusivo inclui o último dia inteiro.
      const start = new Date(`${from}T00:00:00-04:00`);
      const end = new Date(
        new Date(`${to}T00:00:00-04:00`).getTime() + 86400000,
      );
      const inScope = ids.length
        ? sql`${documents.unitId} in ${ids}`
        : sql`false`;
      const inPeriod = (column: unknown) =>
        // Raw queries do not serialize Date parameters.
        sql`${column} >= ${start.toISOString()}::timestamptz and ${column} < ${end.toISOString()}::timestamptz`;

      const [
        [settings],
        pending,
        [submitted],
        [decided],
        [responses],
        distribution,
        top,
        [reads],
      ] = await Promise.all([
        db.select().from(auditDocumentSettings),
        db.execute<{
          unitId: string;
          unitName: string;
          withReviewer: number;
          withTeam: number;
          oldestWithReviewerSince: string | null;
          oldestWithTeamSince: string | null;
        }>(sql`
          select ${documents.unitId} as "unitId", ${organizationUnits.name} as "unitName",
            count(*) filter (where ${documents.status} = 'in_review')::int as "withReviewer",
            count(*) filter (where ${documents.status} = 'correction_requested')::int as "withTeam",
            min(${documents.statusChangedAt}) filter (where ${documents.status} = 'in_review') as "oldestWithReviewerSince",
            min(${documents.statusChangedAt}) filter (where ${documents.status} = 'correction_requested') as "oldestWithTeamSince"
          from ${documents}
          join ${organizationUnits} on ${organizationUnits.id} = ${documents.unitId}
          where ${inScope} and ${documents.status} in ('in_review', 'correction_requested')
          group by ${documents.unitId}, ${organizationUnits.name}
          order by ${organizationUnits.name}`),
        db.execute<{ submitted: number; delivered: number }>(sql`
          select count(*)::int as submitted,
            count(*) filter (where ${documents.status} = 'approved')::int as delivered
          from ${documents}
          where ${inScope} and ${inPeriod(documents.createdAt)}`),
        db.execute<{ approved: number; cancelled: number }>(sql`
          select
            count(distinct ${events.documentId}) filter (where ${events.type} = 'approved')::int as approved,
            count(distinct ${events.documentId}) filter (where ${events.type} = 'cancelled')::int as cancelled
          from ${events}
          join ${documents} on ${documents.id} = ${events.documentId}
          where ${inScope} and ${inPeriod(events.createdAt)}`),
        // Each step is measured from the previous non-read event of the same document.
        db.execute<Record<string, number | null>>(sql`
          with steps as (
            select ${events.type} as type, ${events.createdAt} as at,
              lag(${events.type}) over w as previous_type,
              lag(${events.createdAt}) over w as previous_at
            from ${events}
            join ${documents} on ${documents.id} = ${events.documentId}
            where ${inScope} and ${events.type} <> 'read'
            window w as (partition by ${events.documentId} order by ${events.createdAt}, ${events.id})
          ), timed as (
            select *, ${hours("previous_at", "at")} as elapsed from steps
            where ${inPeriod(sql.raw("at"))}
          )
          select
            count(*) filter (where type in ('approved', 'correction_requested') and previous_type in ('submitted', 'resubmitted', 'reopened'))::int as "reviewerCount",
            avg(elapsed) filter (where type in ('approved', 'correction_requested') and previous_type in ('submitted', 'resubmitted', 'reopened'))::float8 as "reviewerAverage",
            (percentile_cont(0.5) within group (order by elapsed) filter (where type in ('approved', 'correction_requested') and previous_type in ('submitted', 'resubmitted', 'reopened')))::float8 as "reviewerMedian",
            count(*) filter (where type = 'resubmitted' and previous_type = 'correction_requested')::int as "teamCount",
            avg(elapsed) filter (where type = 'resubmitted' and previous_type = 'correction_requested')::float8 as "teamAverage",
            (percentile_cont(0.5) within group (order by elapsed) filter (where type = 'resubmitted' and previous_type = 'correction_requested'))::float8 as "teamMedian"
          from timed`),
        db.execute<{ rounds: number; documents: number }>(sql`
          select ${documents.correctionRounds} as rounds, count(*)::int as documents
          from ${documents}
          where ${inScope} and ${inPeriod(documents.createdAt)}
          group by ${documents.correctionRounds}
          order by ${documents.correctionRounds}`),
        db.execute<{
          id: string;
          title: string;
          unitName: string;
          rounds: number;
        }>(sql`
          select ${documents.id} as id, ${documents.title} as title,
            ${organizationUnits.name} as "unitName", ${documents.correctionRounds} as rounds
          from ${documents}
          join ${organizationUnits} on ${organizationUnits.id} = ${documents.unitId}
          where ${inScope} and ${inPeriod(documents.createdAt)} and ${documents.correctionRounds} > 0
          order by ${documents.correctionRounds} desc, ${documents.createdAt}, ${documents.id}
          limit 10`),
        // ponytail: "reviewer" = anyone who ever decided on an audit document; switch to a
        // permission snapshot on the read event if reviewers start reading without deciding.
        db.execute<Stats & { files: number; readByReviewer: number }>(sql`
          with reviewers as (
            select distinct ${events.actorAccountId} as id from ${events}
            where ${events.type} in ('approved', 'correction_requested', 'reopened')
          ), uploaded as (
            select ${files.createdAt} as uploaded_at,
              (select min(r.created_at) from audit_document_events r
                where r.file_id = ${files.id} and r.type = 'read'
                  and r.actor_account_id in (select id from reviewers)) as first_read_at
            from ${files}
            join ${documents} on ${documents.id} = ${files.documentId}
            where ${inScope} and ${inPeriod(files.createdAt)}
          )
          select count(*)::int as files, count(first_read_at)::int as "readByReviewer",
            ${stats(hours("uploaded_at", "first_read_at"), sql`first_read_at is not null`)}
          from uploaded`),
      ]);
      await recordAudit(db, {
        actorAccountId: user.account.id,
        action: "audit-document.metrics-read",
        objectType: "audit-document-metrics",
        outcome: "success",
        metadata: { from, to, unitId: unitId ?? null },
      });
      const rounds = settings?.bottleneckRounds ?? 3;
      const duration = (prefix: "reviewer" | "team") => ({
        count: responses?.[`${prefix}Count`] ?? 0,
        averageHours: responses?.[`${prefix}Average`] ?? null,
        medianHours: responses?.[`${prefix}Median`] ?? null,
      });
      return reply.header("Cache-Control", "no-store").send({
        units,
        bottleneckRounds: rounds,
        // Raw rows keep timestamps as text.
        pending: pending.map((row) => ({
          ...row,
          oldestWithReviewerSince: date(row.oldestWithReviewerSince),
          oldestWithTeamSince: date(row.oldestWithTeamSince),
        })),
        period: {
          submitted: submitted?.submitted ?? 0,
          approved: decided?.approved ?? 0,
          cancelled: decided?.cancelled ?? 0,
          deliveryRate: ratio(
            submitted?.delivered ?? 0,
            submitted?.submitted ?? 0,
          ),
        },
        reviewerResponse: duration("reviewer"),
        teamResponse: duration("team"),
        correctionRounds: {
          distribution: [...distribution],
          top: top.map((row) => ({ ...row, bottleneck: row.rounds >= rounds })),
        },
        firstRead: {
          count: reads?.count ?? 0,
          averageHours: reads?.averageHours ?? null,
          medianHours: reads?.medianHours ?? null,
        },
        reads: {
          files: reads?.files ?? 0,
          readByReviewer: reads?.readByReviewer ?? 0,
          rate: ratio(reads?.readByReviewer ?? 0, reads?.files ?? 0),
        },
      });
    },
  );
};
