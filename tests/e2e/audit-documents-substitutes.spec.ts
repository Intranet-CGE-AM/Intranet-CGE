import type { APIRequestContext } from "@playwright/test";

import {
  accountId,
  auditRows,
  dedicatedUnit,
  detail,
  freshAccount,
  overrides,
  signInAll,
  transition,
  unique,
} from "./audit-document-api";
import {
  auditTeams,
  createDocument,
  docxFile,
  pdfFile,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test } from "./fixtures";

async function notices(client: APIRequestContext, id: string) {
  const response = await client.get("/api/notifications");
  expect(response.status()).toBe(200);
  return (
    (await response.json()).notifications as { type: string; href: string }[]
  )
    .filter((item) => item.href === `/controle-interno/documentos/${id}`)
    .map((item) => item.type)
    .sort();
}
async function inbox(client: APIRequestContext) {
  const response = await client.get("/api/inbox?type=audit_document");
  expect(response.status()).toBe(200);
  return (await response.json()).items as {
    id: string;
    delegation?: { id: string };
  }[];
}

test("substituto da Subcontroladoria analisa só a equipe da substituição, enquanto ela vale", async ({
  playwright,
  baseURL,
}) => {
  const [admin, reviewer, coordinatorA] = (await signInAll(
    playwright,
    baseURL!,
    "admin",
    "reviewer",
    "coordinatorA",
  )) as [APIRequestContext, APIRequestContext, APIRequestContext];
  const grants = overrides(admin);
  const accounts: APIRequestContext[] = [];
  let substitutionId = "";
  try {
    const unit = await dedicatedUnit(admin, "Equipe substituída E2E");
    const member = await freshAccount(playwright, baseURL!, admin, unit.id);
    const substitute = await freshAccount(playwright, baseURL!, admin, unit.id);
    accounts.push(member.client, substitute.client);
    await grants.add(member.id, "audit_documents.read", unit.id);
    await grants.add(member.id, "audit_documents.submit", unit.id);
    const reviewerId = await accountId(reviewer);

    // Sem substituição, o substituto não enxerga o módulo.
    expect((await substitute.client.get("/api/audit-documents")).status()).toBe(
      403,
    );
    const created = await admin.post("/api/substitutions", {
      data: {
        originalAccountId: reviewerId,
        substituteAccountId: substitute.id,
        unitId: unit.id,
        startsOn: "2020-01-01",
        endsOn: "2099-12-31",
        reason: "Cobertura da análise de documentos de auditoria.",
        flows: ["audit_documents.review"],
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    substitutionId = (await created.json()).id;

    const submitted = await createDocument(
      member.client,
      { unitId: unit.id, title: unique("Documento com substituto E2E") },
      docxFile(),
    );
    expect(submitted.status()).toBe(201);
    const { id } = await submitted.json();

    // NT-10 e IN-07: avisos e pendência chegam ao substituto, com a delegação.
    expect(await notices(substitute.client, id)).toEqual([
      "audit-document.submitted",
    ]);
    expect(await inbox(substitute.client)).toContainEqual(
      expect.objectContaining({
        id: `audit_document:${id}`,
        delegation: expect.objectContaining({ id: substitutionId }),
      }),
    );
    expect(
      [...(await detail(substitute.client, id)).allowedActions].sort(),
    ).toEqual(["approve", "cancel", "edit_version", "request_correction"]);

    // ST-07: revisão só na unidade não muda a configuração global.
    const settings = await substitute.client.put(
      "/api/audit-documents/settings",
      { data: { bottleneckRounds: 4 } },
    );
    expect(settings.status()).toBe(403);

    const correction = await transition(substitute.client, id, {
      action: "request_correction",
      version: 1,
      message: "Correção pedida pelo substituto.",
    });
    expect(correction.status()).toBe(200);
    expect(
      (
        await uploadVersion(member.client, id, { version: 2 }, pdfFile())
      ).status(),
    ).toBe(201);
    expect(await notices(substitute.client, id)).toEqual([
      "audit-document.resubmitted",
      "audit-document.submitted",
    ]);
    expect(
      (
        await uploadVersion(
          substitute.client,
          id,
          { version: 3, source: "editor" },
          docxFile(),
        )
      ).status(),
    ).toBe(201);
    expect(
      (
        await transition(substitute.client, id, {
          action: "approve",
          version: 4,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await transition(substitute.client, id, {
          action: "reopen",
          version: 5,
          message: "Reaberto pelo substituto.",
        })
      ).status(),
    ).toBe(200);
    const events = (await detail(member.client, id)).events.filter((event) =>
      ["correction_requested", "approved", "reopened"].includes(event.type),
    );
    expect(events).toHaveLength(3);
    for (const event of events)
      expect(event).toMatchObject({
        actorAccountId: substitute.id,
        delegation: { id: substitutionId, originalAccountId: reviewerId },
      });
    const rows = await auditRows(admin, id, {
      action: "audit-document.approve,audit-document.reopen",
    });
    expect(rows).toHaveLength(2);
    for (const row of rows)
      expect(row.metadata).toMatchObject({
        delegation: { id: substitutionId },
      });

    // AZ-13: fora da unidade da substituição, 404 com auditoria.
    const teamA = await unitId(admin, auditTeams.a);
    const other = await createDocument(
      coordinatorA,
      { unitId: teamA, title: unique("Fora da substituição E2E") },
      docxFile(),
    );
    const otherId = (await other.json()).id as string;
    expect(
      (await substitute.client.get(`/api/audit-documents/${otherId}`)).status(),
    ).toBe(404);
    expect(
      (
        await transition(substitute.client, otherId, {
          action: "approve",
          version: 1,
        })
      ).status(),
    ).toBe(404);
    expect(
      (await auditRows(admin, otherId, { outcome: "denied" })).filter(
        (row) => row.actor?.accountId === substitute.id,
      ),
    ).toHaveLength(2);
    expect(await notices(substitute.client, otherId)).toEqual([]);

    // AZ-14: substituição cancelada tira o acesso na hora.
    const cancelled = await admin.post(
      `/api/substitutions/${substitutionId}/cancel`,
      { data: { version: 1 } },
    );
    expect(cancelled.status()).toBe(200);
    substitutionId = "";
    expect(
      (
        await transition(substitute.client, id, {
          action: "approve",
          version: 6,
        })
      ).status(),
    ).toBe(404);
    expect(
      (await substitute.client.get(`/api/audit-documents/${id}`)).status(),
    ).toBe(404);
    expect(
      (await inbox(substitute.client)).map((item) => item.id),
    ).not.toContain(`audit_document:${id}`);
    // Nova versão da equipe não avisa mais o ex-substituto.
    const before = await notices(substitute.client, id);
    await transition(reviewer, id, {
      action: "request_correction",
      version: 6,
      message: "Correção após a substituição.",
    });
    expect(
      (
        await uploadVersion(member.client, id, { version: 7 }, pdfFile())
      ).status(),
    ).toBe(201);
    expect(await notices(substitute.client, id)).toEqual(before);
    expect(await notices(reviewer, id)).toContain("audit-document.resubmitted");
  } finally {
    if (substitutionId)
      await admin.post(`/api/substitutions/${substitutionId}/cancel`, {
        data: { version: 1 },
      });
    await grants.revoke();
    await Promise.all(
      [...accounts, admin, reviewer, coordinatorA].map((client) =>
        client.dispose(),
      ),
    );
  }
});
