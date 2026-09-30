import type { APIRequestContext } from "@playwright/test";

import { createDatabase } from "../../apps/api/src/db/client.js";
import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxFile,
  pdfFile,
  signIn,
  unitId as teamId,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test, tuple } from "./fixtures";

// Fixed past days in Manaus (UTC-4, no DST), far from any other spec, so the
// numbers below are exact and do not depend on the clock of the run.
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e";
const at = (day: string, time: string) => `${day}T${time}:00-04:00`;
const iso = (value: string) => new Date(value).toISOString();

type Doc = { id: string; version: number; files: { id: string }[] };
type Timeline = {
  /** Event types in the order the API created them, with their backdated time. */
  events: [type: string, at: string][];
  /** Version files in upload order. */
  files: string[];
};

async function act(
  client: APIRequestContext,
  doc: Doc,
  action: string,
  message?: string,
) {
  const response = await client.post(
    `/api/audit-documents/${doc.id}/transition`,
    { data: { action, version: doc.version, message } },
  );
  expect(response.status()).toBe(200);
  doc.version = ((await response.json()) as { version: number }).version;
}

async function resubmit(client: APIRequestContext, doc: Doc) {
  const response = await uploadVersion(
    client,
    doc.id,
    { version: doc.version },
    pdfFile(),
  );
  expect(response.status()).toBe(201);
  const body = (await response.json()) as Doc;
  doc.version = body.version;
  doc.files = body.files;
}

async function read(client: APIRequestContext, doc: Doc, index: number) {
  const file = doc.files[index];
  expect(
    (
      await client.get(`/api/audit-documents/${doc.id}/files/${file!.id}`)
    ).status(),
  ).toBe(200);
}

test.describe("indicadores de auditoria com cenário calculado à mão", () => {
  let sql: ReturnType<typeof createDatabase>["client"];
  test.beforeAll(() => {
    sql = createDatabase(databaseUrl).client;
  });
  test.afterAll(async () => {
    await sql.end();
  });

  // Fixture temporal externa: não há API para retroagir o relógio. Os
  // registros nascem pela API e só os horários são movidos; as verificações
  // seguem exclusivamente por HTTP.
  async function backdate(id: string, timeline: Timeline) {
    const events = await sql<{ id: string; type: string }[]>`
      select id, type from audit_document_events
      where document_id = ${id} order by created_at, id`;
    expect(events.map((event) => event.type)).toEqual(
      timeline.events.map(([type]) => type),
    );
    for (const [index, event] of events.entries())
      await sql`update audit_document_events set created_at = ${timeline.events[index]![1]} where id = ${event.id}`;
    const files = await sql<{ id: string }[]>`
      select id from audit_document_files where document_id = ${id} order by number`;
    expect(files).toHaveLength(timeline.files.length);
    for (const [index, file] of files.entries())
      await sql`update audit_document_files set created_at = ${timeline.files[index]!} where id = ${file.id}`;
    const statusChanges = timeline.events.filter(([type]) => type !== "read");
    await sql`update audit_documents
      set created_at = ${timeline.events[0]![1]},
        status_changed_at = ${statusChanges.at(-1)![1]}
      where id = ${id}`;
  }

  test("pendências, coorte, tempos, rodadas e leituras batem com o cálculo manual", async ({
    playwright,
    baseURL,
  }) => {
    const clients = await Promise.all(
      [
        auditAccounts.admin,
        auditAccounts.coordinatorA,
        auditAccounts.reviewer,
        auditAccounts.assessorA,
      ].map((email) => signIn(playwright, baseURL!, email)),
    );
    const [admin, coordinator, reviewer, assessor] = tuple(clients, 4);
    const grants: string[] = [];
    const settings = (await (
      await reviewer.get("/api/audit-documents/settings")
    ).json()) as { bottleneckRounds: number };
    const stamp = Date.now();
    try {
      const createUnit = async (name: string) => {
        const response = await admin.post("/api/organization-units", {
          data: { code: `AUD-W-${stamp}-${name.length}`, name },
        });
        expect(response.status()).toBe(201);
        return ((await response.json()) as { id: string }).id;
      };
      const unitName = `Equipe Métricas Calculadas ${stamp}`;
      const otherName = `Equipe Métricas Filtro ${stamp}-2`;
      const unit = await createUnit(unitName);
      const other = await createUnit(otherName);
      const me = await (await coordinator.get("/api/auth/me")).json();
      for (const unitId of [unit, other])
        for (const permission of [
          "audit_documents.read",
          "audit_documents.submit",
        ]) {
          const grant = await admin.post("/api/admin/permission-overrides", {
            data: {
              accountId: me.user.account.id,
              permission,
              effect: "allow",
              unitId,
            },
          });
          expect(grant.status()).toBe(201);
          grants.push((await grant.json()).id);
        }
      expect(
        (
          await reviewer.put("/api/audit-documents/settings", {
            data: { bottleneckRounds: 2 },
          })
        ).status(),
      ).toBe(200);

      const submit = async (name: string, target = unit) => {
        const response = await createDocument(
          coordinator,
          { unitId: target, title: `Métricas ${name} ${stamp}` },
          docxFile(),
        );
        expect(response.status()).toBe(201);
        return (await response.json()) as Doc;
      };
      const day = "2003-03-10";

      // D1: lido pela revisão, uma correção, nova versão e aprovado.
      const d1 = await submit("D1");
      await read(reviewer, d1, 0);
      await act(reviewer, d1, "request_correction", "Ajustar anexos.");
      await resubmit(coordinator, d1);
      await act(reviewer, d1, "approve");
      await backdate(d1.id, {
        events: [
          ["submitted", at(day, "08:00")],
          ["read", at(day, "09:00")],
          ["correction_requested", at(day, "10:00")],
          ["resubmitted", at(day, "14:00")],
          ["approved", at(day, "16:00")],
        ],
        files: [at(day, "08:00"), at(day, "14:00")],
      });

      // D2: aguarda a revisão; só a própria equipe abriu (não conta).
      const d2 = await submit("D2");
      await read(coordinator, d2, 0);
      await backdate(d2.id, {
        events: [
          ["submitted", at(day, "09:00")],
          ["read", at(day, "10:00")],
        ],
        files: [at(day, "09:00")],
      });

      // D3: correção pedida, ainda com a equipe.
      const d3 = await submit("D3");
      await act(reviewer, d3, "request_correction", "Detalhar achados.");
      await backdate(d3.id, {
        events: [
          ["submitted", at(day, "07:00")],
          ["correction_requested", at(day, "13:00")],
        ],
        files: [at(day, "07:00")],
      });

      // D4: cancelado pela equipe (não é resposta da revisão).
      const d4 = await submit("D4");
      await act(coordinator, d4, "cancel", "Enviado em duplicidade.");
      await backdate(d4.id, {
        events: [
          ["submitted", at(day, "11:00")],
          ["cancelled", at(day, "12:00")],
        ],
        files: [at(day, "11:00")],
      });

      // D5: duas rodadas de correção, a terceira versão aguarda a revisão.
      const d5 = await submit("D5");
      await read(reviewer, d5, 0);
      await act(reviewer, d5, "request_correction", "Primeira rodada.");
      await resubmit(coordinator, d5);
      await act(reviewer, d5, "request_correction", "Segunda rodada.");
      await resubmit(coordinator, d5);
      await backdate(d5.id, {
        events: [
          ["submitted", at(day, "06:00")],
          ["read", at(day, "06:30")],
          ["correction_requested", at(day, "07:00")],
          ["resubmitted", at(day, "08:00")],
          ["correction_requested", at(day, "09:00")],
          ["resubmitted", at(day, "12:00")],
        ],
        files: [at(day, "06:00"), at(day, "08:00"), at(day, "12:00")],
      });

      // D6: enviado na véspera, aprovado, reaberto e aprovado de novo no dia.
      const d6 = await submit("D6");
      await act(reviewer, d6, "approve");
      await act(reviewer, d6, "reopen", "Nova evidência.");
      await act(reviewer, d6, "approve");
      await backdate(d6.id, {
        events: [
          ["submitted", at("2003-03-09", "20:00")],
          ["approved", at(day, "08:00")],
          ["reopened", at(day, "09:00")],
          ["approved", at(day, "10:00")],
        ],
        files: [at("2003-03-09", "20:00")],
      });

      // D7 às 23:30 de Manaus (03:30Z do dia seguinte) entra no dia; D8 às
      // 00:30 do dia seguinte fica fora.
      const d7 = await submit("D7");
      await backdate(d7.id, {
        events: [["submitted", at(day, "23:30")]],
        files: [at(day, "23:30")],
      });
      const d8 = await submit("D8");
      await backdate(d8.id, {
        events: [["submitted", at("2003-03-11", "00:30")]],
        files: [at("2003-03-11", "00:30")],
      });

      // Outra equipe, só para os filtros.
      const u2 = await submit("U2", other);
      await backdate(u2.id, {
        events: [["submitted", at(day, "12:00")]],
        files: [at(day, "12:00")],
      });

      const metrics = async (
        client: APIRequestContext,
        query: string,
        status = 200,
      ) => {
        const response = await client.get(
          `/api/audit-documents/metrics?${query}`,
        );
        expect(response.status()).toBe(status);
        return response.json();
      };
      const result = await metrics(
        reviewer,
        `from=${day}&to=${day}&unitId=${unit}`,
      );

      expect(result.bottleneckRounds).toBe(2);
      // Situação atual: D2, D5, D7 e D8 com a revisão; D3 com a equipe.
      expect(result.pending).toEqual([
        {
          unitId: unit,
          unitName,
          withReviewer: 4,
          withTeam: 1,
          oldestWithReviewerSince: iso(at(day, "09:00")),
          oldestWithTeamSince: iso(at(day, "13:00")),
        },
      ]);
      // Coorte do dia: D1, D2, D3, D4, D5 e D7. D6 (véspera) e D8 (dia
      // seguinte) ficam fora, mas as duas aprovações de D6 no dia contam.
      expect(result.period).toEqual({
        documentsSubmitted: 6,
        documentsApprovedNow: 1,
        documentsCancelled: 1,
        approvalEvents: 3,
        deliveryRate: 1 / 6,
      });
      expect(result.perTeam).toEqual([
        {
          unitId: unit,
          unitName,
          documentsSubmitted: 6,
          documentsApprovedNow: 1,
          deliveryRate: 1 / 6,
        },
      ]);
      // Respostas da revisão: D1 2 h e 2 h; D3 6 h; D5 1 h e 1 h; D6 12 h
      // (véspera 20:00 até 08:00) e 1 h após reabrir. Soma 25 h em 7.
      expect(result.reviewerResponse.count).toBe(7);
      expect(result.reviewerResponse.averageHours).toBeCloseTo(25 / 7, 6);
      expect(result.reviewerResponse.medianHours).toBeCloseTo(2, 6);
      // Respostas da equipe: D1 4 h; D5 1 h e 3 h. D3 segue em aberto.
      expect(result.teamResponse.count).toBe(3);
      expect(result.teamResponse.averageHours).toBeCloseTo(8 / 3, 6);
      expect(result.teamResponse.medianHours).toBeCloseTo(3, 6);
      expect(result.correctionRounds.distribution).toEqual([
        { rounds: 0, documents: 3 },
        { rounds: 1, documents: 2 },
        { rounds: 2, documents: 1 },
      ]);
      // Rodadas desc, depois primeiro envio asc: D5, D3 (07:00), D1 (08:00).
      expect(result.correctionRounds.top).toEqual(
        [
          [d5, "D5", 2, true],
          [d3, "D3", 1, false],
          [d1, "D1", 1, false],
        ].map(([doc, name, rounds, bottleneck]) => ({
          id: (doc as Doc).id,
          title: `Métricas ${name} ${stamp}`,
          unitName,
          rounds,
          bottleneck,
        })),
      );
      // 9 versões no dia (D1 x2, D2, D3, D4, D5 x3, D7); a revisão abriu D1 v1
      // (1 h) e D5 v1 (30 min). A leitura da equipe em D2 não conta.
      expect(result.reads).toEqual({
        files: 9,
        readByReviewer: 2,
        rate: 2 / 9,
      });
      expect(result.firstRead.count).toBe(2);
      expect(result.firstRead.averageHours).toBeCloseTo(0.75, 6);
      expect(result.firstRead.medianHours).toBeCloseTo(0.75, 6);

      // O dia seguinte só tem D8.
      const next = await metrics(
        reviewer,
        `from=2003-03-11&to=2003-03-11&unitId=${unit}`,
      );
      expect(next.period).toMatchObject({
        documentsSubmitted: 1,
        approvalEvents: 0,
      });

      // Período vazio: contagens zeradas, taxas e tempos nulos.
      const empty = await metrics(
        reviewer,
        `from=2001-01-01&to=2001-01-01&unitId=${unit}`,
      );
      expect(empty.period).toEqual({
        documentsSubmitted: 0,
        documentsApprovedNow: 0,
        documentsCancelled: 0,
        approvalEvents: 0,
        deliveryRate: null,
      });
      expect(empty.perTeam).toEqual([]);
      for (const stats of [
        empty.reviewerResponse,
        empty.teamResponse,
        empty.firstRead,
      ])
        expect(stats).toEqual({
          count: 0,
          averageHours: null,
          medianHours: null,
        });
      expect(empty.correctionRounds).toEqual({ distribution: [], top: [] });
      expect(empty.reads).toEqual({ files: 0, readByReviewer: 0, rate: null });

      // Filtro por equipe e visão global da revisão.
      const filtered = await metrics(
        reviewer,
        `from=${day}&to=${day}&unitId=${other}`,
      );
      expect(filtered.pending).toEqual([
        expect.objectContaining({
          unitId: other,
          withReviewer: 1,
          withTeam: 0,
        }),
      ]);
      expect(filtered.perTeam).toEqual([
        expect.objectContaining({ unitId: other, documentsSubmitted: 1 }),
      ]);
      const global = await metrics(reviewer, `from=${day}&to=${day}`);
      for (const [id, withReviewer, submitted] of [
        [unit, 4, 6],
        [other, 1, 1],
      ] as const) {
        expect(global.pending).toContainEqual(
          expect.objectContaining({ unitId: id, withReviewer }),
        );
        expect(global.perTeam).toContainEqual(
          expect.objectContaining({
            unitId: id,
            documentsSubmitted: submitted,
          }),
        );
      }

      // Escopo: a coordenação só vê a própria equipe; sem a chave, 403.
      const own = await teamId(coordinator, auditTeams.a);
      const scoped = await metrics(coordinator, `from=${day}&to=${day}`);
      expect(scoped.units).toEqual([{ id: own, name: auditTeams.a }]);
      for (const row of [...scoped.pending, ...scoped.perTeam])
        expect(row.unitId).toBe(own);
      await metrics(coordinator, `from=${day}&to=${day}&unitId=${unit}`, 403);
      await metrics(assessor, `from=${day}&to=${day}`, 403);
    } finally {
      await reviewer.put("/api/audit-documents/settings", {
        data: { bottleneckRounds: settings.bottleneckRounds },
      });
      for (const id of grants)
        await admin.delete(`/api/admin/permission-overrides/${id}`);
      await Promise.all(clients.map((client) => client.dispose()));
    }
  });

  test("ranking desempata por primeiro envio e depois por título", async ({
    playwright,
    baseURL,
  }) => {
    const clients = await Promise.all(
      [
        auditAccounts.admin,
        auditAccounts.coordinatorA,
        auditAccounts.reviewer,
      ].map((email) => signIn(playwright, baseURL!, email)),
    );
    const [admin, coordinator, reviewer] = tuple(clients, 3);
    const grants: string[] = [];
    const settings = (await (
      await reviewer.get("/api/audit-documents/settings")
    ).json()) as { bottleneckRounds: number };
    const stamp = Date.now();
    try {
      const created = await admin.post("/api/organization-units", {
        data: {
          code: `AUD-R-${stamp}`,
          name: `Equipe Ranking ${stamp}`,
        },
      });
      expect(created.status()).toBe(201);
      const unit = ((await created.json()) as { id: string }).id;
      const me = await (await coordinator.get("/api/auth/me")).json();
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: me.user.account.id,
          permission: "audit_documents.submit",
          effect: "allow",
          unitId: unit,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
      expect(
        (
          await reviewer.put("/api/audit-documents/settings", {
            data: { bottleneckRounds: 1 },
          })
        ).status(),
      ).toBe(200);

      const day = "2003-04-10";
      const withOneRound = async (time: string) => {
        const response = await createDocument(
          coordinator,
          { unitId: unit, title: `Ranking provisório ${stamp}` },
          docxFile(),
        );
        expect(response.status()).toBe(201);
        const doc = (await response.json()) as Doc;
        await act(reviewer, doc, "request_correction", "Ajustar.");
        await backdate(doc.id, {
          events: [
            ["submitted", at(day, time)],
            ["correction_requested", at(day, "15:00")],
          ],
          files: [at(day, time)],
        });
        return doc.id;
      };
      // Dois documentos empatados em rodadas e horário; um mais antigo.
      const tied = [await withOneRound("09:00"), await withOneRound("09:00")];
      const earliest = await withOneRound("08:00");
      // Títulos em ordem inversa à dos ids, para o desempate por id falhar.
      const [first, second] = [...tied].sort().reverse();
      const titles = new Map([
        [earliest, `Ranking Z ${stamp}`],
        [first!, `Ranking A ${stamp}`],
        [second!, `Ranking B ${stamp}`],
      ]);
      for (const [id, title] of titles)
        await sql`update audit_documents set title = ${title} where id = ${id}`;

      const response = await reviewer.get(
        `/api/audit-documents/metrics?from=${day}&to=${day}&unitId=${unit}`,
      );
      expect(response.status()).toBe(200);
      const { correctionRounds } = await response.json();
      expect(
        correctionRounds.top.map(
          (row: { id: string; title: string; bottleneck: boolean }) => [
            row.title,
            row.bottleneck,
          ],
        ),
      ).toEqual([
        [`Ranking Z ${stamp}`, true],
        [`Ranking A ${stamp}`, true],
        [`Ranking B ${stamp}`, true],
      ]);
    } finally {
      await reviewer.put("/api/audit-documents/settings", {
        data: { bottleneckRounds: settings.bottleneckRounds },
      });
      for (const id of grants)
        await admin.delete(`/api/admin/permission-overrides/${id}`);
      await Promise.all(clients.map((client) => client.dispose()));
    }
  });

  test("período aceita até 366 dias corridos, inclusive", async ({
    playwright,
    baseURL,
  }) => {
    const reviewer = await signIn(playwright, baseURL!, auditAccounts.reviewer);
    try {
      for (const [from, to, status] of [
        // 2004 é bissexto: 01/01 a 31/12 são 366 dias.
        ["2004-01-01", "2004-12-31", 200],
        ["2004-01-01", "2005-01-01", 400],
        ["2003-03-10", "2003-03-10", 200],
        ["2003-03-11", "2003-03-10", 400],
        ["2003-02-30", "2003-03-10", 400],
      ] as const)
        expect(
          (
            await reviewer.get(
              `/api/audit-documents/metrics?from=${from}&to=${to}`,
            )
          ).status(),
          `${from}..${to}`,
        ).toBe(status);
      expect(
        (
          await reviewer.get(
            "/api/audit-documents/metrics?from=2003-03-10&to=2003-03-10&extra=1",
          )
        ).status(),
      ).toBe(400);
    } finally {
      await reviewer.dispose();
    }
  });
});
