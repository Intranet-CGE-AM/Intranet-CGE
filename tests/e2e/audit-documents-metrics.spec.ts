import type { APIRequestContext } from "@playwright/test";

import {
  auditAccounts,
  createDocument,
  docxFile,
  pdfFile,
  signIn,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test, tuple } from "./fixtures";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(
    new Date(),
  );

async function transition(
  client: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
) {
  const response = await client.post(`/api/audit-documents/${id}/transition`, {
    data,
  });
  expect(response.status()).toBe(200);
}

test("indicadores refletem duas rodadas de correção, pendências e leituras", async ({
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
  let grantId = "";
  // O servidor carimba os eventos com o próprio relógio: se a execução cruzar
  // a meia-noite de Manaus, o cenário fica em dois dias e o período cobre ambos.
  const from = today();
  const { bottleneckRounds } = (await (
    await reviewer.get("/api/audit-documents/settings")
  ).json()) as { bottleneckRounds: number };
  try {
    // Equipe exclusiva do cenário, para os números não dependerem de outros specs.
    const unit = await admin.post("/api/organization-units", {
      data: { code: `AUD-M-${Date.now()}`, name: "Equipe de Métricas E2E" },
    });
    expect(unit.status()).toBe(201);
    const unitId = (await unit.json()).id as string;
    const me = await (await coordinator.get("/api/auth/me")).json();
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: me.user.account.id,
        permission: "audit_documents.submit",
        effect: "allow",
        unitId,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    expect(
      (
        await reviewer.put("/api/audit-documents/settings", {
          data: { bottleneckRounds: 2 },
        })
      ).status(),
    ).toBe(200);

    const submit = async (title: string) => {
      const response = await createDocument(
        coordinator,
        { unitId, title },
        docxFile(),
      );
      expect(response.status()).toBe(201);
      return (await response.json()) as { id: string; files: { id: string }[] };
    };

    // D1: lido na v1, duas rodadas de correção e aprovado na v3.
    const d1 = await submit("Métricas D1 E2E");
    expect(
      (
        await reviewer.get(
          `/api/audit-documents/${d1.id}/files/${d1.files[0]!.id}`,
        )
      ).status(),
    ).toBe(200);
    await transition(reviewer, d1.id, {
      action: "request_correction",
      version: 1,
      message: "Primeira rodada.",
    });
    expect(
      (
        await uploadVersion(coordinator, d1.id, { version: 2 }, pdfFile())
      ).status(),
    ).toBe(201);
    await transition(reviewer, d1.id, {
      action: "request_correction",
      version: 3,
      message: "Segunda rodada.",
    });
    expect(
      (
        await uploadVersion(coordinator, d1.id, { version: 4 }, pdfFile())
      ).status(),
    ).toBe(201);
    await transition(reviewer, d1.id, { action: "approve", version: 5 });
    // Reaberto e aprovado de novo: dois eventos de aprovação, um documento aprovado.
    await transition(reviewer, d1.id, {
      action: "reopen",
      version: 6,
      message: "Ajuste final.",
    });
    await transition(reviewer, d1.id, { action: "approve", version: 7 });
    // D2 aguarda a Subcontroladoria; D3 aguarda a equipe; D4 foi cancelado.
    await submit("Métricas D2 E2E");
    const d3 = await submit("Métricas D3 E2E");
    await transition(reviewer, d3.id, {
      action: "request_correction",
      version: 1,
      message: "Ajustar.",
    });
    const d4 = await submit("Métricas D4 E2E");
    await transition(coordinator, d4.id, {
      action: "cancel",
      version: 1,
      message: "Duplicado.",
    });

    const query = `/api/audit-documents/metrics?from=${from}&to=${today()}&unitId=${unitId}`;
    expect((await assessor.get(query)).status()).toBe(403);
    expect((await coordinator.get(query)).status()).toBe(403);
    const response = await reviewer.get(query);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const metrics = await response.json();

    expect(metrics.bottleneckRounds).toBe(2);
    expect(metrics.pending).toHaveLength(1);
    expect(metrics.pending[0]).toMatchObject({
      unitId,
      withReviewer: 1,
      withTeam: 1,
    });
    expect(metrics.pending[0].oldestWithReviewerSince).not.toBeNull();
    expect(metrics.pending[0].oldestWithTeamSince).not.toBeNull();
    expect(metrics.period).toEqual({
      documentsSubmitted: 4,
      documentsApprovedNow: 1,
      documentsCancelled: 1,
      approvalEvents: 2,
      deliveryRate: 0.25,
    });
    expect(metrics.perTeam).toEqual([
      {
        unitId,
        unitName: "Equipe de Métricas E2E",
        documentsSubmitted: 4,
        documentsApprovedNow: 1,
        deliveryRate: 0.25,
      },
    ]);
    // D1: 4 análises (2 correções, aprovação, aprovação após reabrir); D3: 1 correção.
    expect(metrics.reviewerResponse.count).toBe(5);
    expect(metrics.reviewerResponse.averageHours).toBeGreaterThanOrEqual(0);
    expect(metrics.reviewerResponse.medianHours).toBeGreaterThanOrEqual(0);
    // D1: duas novas versões após correção.
    expect(metrics.teamResponse.count).toBe(2);
    expect(metrics.correctionRounds.distribution).toEqual([
      { rounds: 0, documents: 2 },
      { rounds: 1, documents: 1 },
      { rounds: 2, documents: 1 },
    ]);
    expect(metrics.correctionRounds.top).toEqual([
      {
        id: d1.id,
        title: "Métricas D1 E2E",
        unitName: "Equipe de Métricas E2E",
        rounds: 2,
        bottleneck: true,
      },
      {
        id: d3.id,
        title: "Métricas D3 E2E",
        unitName: "Equipe de Métricas E2E",
        rounds: 1,
        bottleneck: false,
      },
    ]);
    // 6 arquivos (D1 v1..v3, D2, D3, D4); a Subcontroladoria abriu só D1 v1.
    expect(metrics.firstRead.count).toBe(1);
    expect(metrics.reads).toEqual({
      files: 6,
      readByReviewer: 1,
      rate: 1 / 6,
    });

    const audit = await admin.get(
      "/api/audit-events?action=audit-document.metrics-read&pageSize=5",
    );
    expect((await audit.json()).pagination.total).toBeGreaterThanOrEqual(1);
  } finally {
    await reviewer.put("/api/audit-documents/settings", {
      data: { bottleneckRounds },
    });
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
