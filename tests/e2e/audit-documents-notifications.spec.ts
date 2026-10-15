import type { APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { inboxItems } from "./audit-document-api";
import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxFile,
  pdfFile,
  signIn,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test, tuple } from "./fixtures";

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
const inbox = async (client: APIRequestContext) =>
  (await inboxItems(client)).map((item) => item.id);

test("envio avisa a Subcontroladoria e decisões avisam quem enviou versões", async ({
  playwright,
  baseURL,
}) => {
  const clients = await Promise.all(
    [
      auditAccounts.coordinatorA,
      auditAccounts.assessorA,
      auditAccounts.reviewer,
      auditAccounts.coordinatorB,
    ].map((email) => signIn(playwright, baseURL!, email)),
  );
  const [coordinator, assessor, reviewer, otherTeam] = tuple(clients, 4);
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const created = await createDocument(
      coordinator,
      { unitId: teamA, title: "Relatório com avisos E2E" },
      docxFile(),
    );
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const item = `audit_document:${id}`;

    expect(await notices(reviewer, id)).toEqual(["audit-document.submitted"]);
    for (const client of [coordinator, assessor, otherTeam])
      expect(await notices(client, id)).toEqual([]);
    expect(await inbox(reviewer)).toContain(item);
    expect(await inbox(coordinator)).not.toContain(item);

    const correction = await reviewer.post(
      `/api/audit-documents/${id}/transition`,
      {
        data: {
          action: "request_correction",
          version: 1,
          message: "Completar as evidências.",
        },
      },
    );
    expect(correction.status()).toBe(200);
    expect(await notices(coordinator, id)).toEqual([
      "audit-document.correction_requested",
    ]);
    expect(await notices(assessor, id)).toEqual([]);
    expect(await notices(reviewer, id)).toEqual(["audit-document.submitted"]);
    expect(await inbox(coordinator)).toContain(item);
    expect(await inbox(assessor)).toContain(item);
    expect(await inbox(reviewer)).not.toContain(item);

    expect(
      (await uploadVersion(assessor, id, { version: 2 }, pdfFile())).status(),
    ).toBe(201);
    expect(await notices(reviewer, id)).toEqual([
      "audit-document.resubmitted",
      "audit-document.submitted",
    ]);
    expect(await notices(coordinator, id)).toEqual([
      "audit-document.correction_requested",
    ]);

    const approved = await reviewer.post(
      `/api/audit-documents/${id}/transition`,
      { data: { action: "approve", version: 3 } },
    );
    expect(approved.status()).toBe(200);
    expect(await notices(coordinator, id)).toEqual([
      "audit-document.approved",
      "audit-document.correction_requested",
    ]);
    expect(await notices(assessor, id)).toEqual(["audit-document.approved"]);
    expect(await notices(reviewer, id)).toHaveLength(2);
    for (const client of [coordinator, assessor, reviewer])
      expect(await inbox(client)).not.toContain(item);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

async function submit(client: APIRequestContext, unit: string) {
  const response = await createDocument(
    client,
    { unitId: unit, title: `Avisos E2E ${randomUUID().slice(0, 8)}` },
    docxFile(),
  );
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}
async function act(
  client: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
) {
  const response = await client.post(`/api/audit-documents/${id}/transition`, {
    data,
  });
  expect(response.status(), await response.text()).toBe(200);
}

test("cancelamento, reabertura e edição avisam quem enviou, nunca quem agiu", async ({
  playwright,
  baseURL,
}) => {
  const clients = await Promise.all(
    [
      auditAccounts.coordinatorA,
      auditAccounts.assessorA,
      auditAccounts.reviewer,
    ].map((email) => signIn(playwright, baseURL!, email)),
  );
  const [coordinator, assessor, reviewer] = tuple(clients, 3);
  try {
    const teamA = await unitId(coordinator, auditTeams.a);

    // NT-05: coordenação enviou v1, assessoria v2; a coordenação cancela.
    const cancelled = await submit(coordinator, teamA);
    await act(reviewer, cancelled, {
      action: "request_correction",
      version: 1,
      message: "Corrigir a tabela.",
    });
    expect(
      (
        await uploadVersion(assessor, cancelled, { version: 2 }, pdfFile())
      ).status(),
    ).toBe(201);
    await act(coordinator, cancelled, {
      action: "cancel",
      version: 3,
      message: "Relatório substituído.",
    });
    expect(await notices(assessor, cancelled)).toEqual([
      "audit-document.cancelled",
    ]);
    expect(await notices(coordinator, cancelled)).toEqual([
      "audit-document.correction_requested",
    ]);

    // NT-06 e NT-08: a coordenação enviou v1 e v3; aprovação avisa uma vez.
    const reopened = await submit(coordinator, teamA);
    await act(reviewer, reopened, {
      action: "request_correction",
      version: 1,
      message: "Ajustar conclusão.",
    });
    expect(
      (
        await uploadVersion(coordinator, reopened, { version: 2 }, pdfFile())
      ).status(),
    ).toBe(201);
    await act(reviewer, reopened, { action: "approve", version: 3 });
    expect(await notices(coordinator, reopened)).toEqual([
      "audit-document.approved",
      "audit-document.correction_requested",
    ]);
    const reviewerBefore = await notices(reviewer, reopened);
    await act(reviewer, reopened, {
      action: "reopen",
      version: 4,
      message: "Faltou um anexo.",
    });
    expect(await notices(coordinator, reopened)).toEqual([
      "audit-document.approved",
      "audit-document.correction_requested",
      "audit-document.reopened",
    ]);
    expect(await notices(assessor, reopened)).toEqual([]);
    expect(await notices(reviewer, reopened)).toEqual(reviewerBefore);
    expect(await inbox(reviewer)).toContain(`audit_document:${reopened}`);

    // NT-07: edição da revisão avisa a equipe que enviou.
    expect(
      (
        await uploadVersion(
          reviewer,
          reopened,
          { version: 5, source: "editor" },
          docxFile(),
        )
      ).status(),
    ).toBe(201);
    expect(await notices(coordinator, reopened)).toContain(
      "audit-document.edited",
    );
    expect(await notices(reviewer, reopened)).toEqual(reviewerBefore);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("quem envia com a chave de revisão não recebe o próprio aviso nem a pendência", async ({
  playwright,
  baseURL,
}) => {
  const clients = await Promise.all(
    [
      auditAccounts.admin,
      auditAccounts.reviewer,
      auditAccounts.coordinatorA,
      auditAccounts.assessorA,
      auditAccounts.coordinatorB,
    ].map((email) => signIn(playwright, baseURL!, email)),
  );
  const [admin, reviewer, coordinator, assessor, otherTeam] = tuple(clients, 5);
  try {
    const teamA = await unitId(admin, auditTeams.a);
    const id = await submit(admin, teamA);
    const item = `audit_document:${id}`;
    expect(await notices(admin, id)).toEqual([]);
    expect(await notices(reviewer, id)).toEqual(["audit-document.submitted"]);
    expect(await inbox(admin)).not.toContain(item);
    expect(await inbox(reviewer)).toContain(item);

    // Correção da equipe A não entra na caixa da equipe B.
    await act(reviewer, id, {
      action: "request_correction",
      version: 1,
      message: "Completar anexos.",
    });
    expect(await inbox(coordinator)).toContain(item);
    expect(await inbox(assessor)).toContain(item);
    expect(await inbox(otherTeam)).not.toContain(item);

    // Cancelado a partir da correção sai de todas as caixas.
    await act(coordinator, id, {
      action: "cancel",
      version: 2,
      message: "Documento duplicado.",
    });
    for (const client of clients)
      expect(await inbox(client)).not.toContain(item);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("versão da equipe em análise avisa a Subcontroladoria, como a resposta à correção", async ({
  playwright,
  baseURL,
}) => {
  const clients = await Promise.all(
    [
      auditAccounts.coordinatorA,
      auditAccounts.assessorA,
      auditAccounts.reviewer,
    ].map((email) => signIn(playwright, baseURL!, email)),
  );
  const [coordinator, assessor, reviewer] = tuple(clients, 3);
  try {
    const id = await submit(
      coordinator,
      await unitId(coordinator, auditTeams.a),
    );
    const item = `audit_document:${id}`;
    expect(
      (await uploadVersion(assessor, id, { version: 1 }, pdfFile())).status(),
    ).toBe(201);
    expect(await notices(reviewer, id)).toEqual([
      "audit-document.resubmitted",
      "audit-document.submitted",
    ]);
    // Colegas de equipe não são avisados; a pendência segue com a revisão.
    for (const client of [coordinator, assessor])
      expect(await notices(client, id)).toEqual([]);
    expect(await inbox(reviewer)).toContain(item);
    for (const client of [coordinator, assessor])
      expect(await inbox(client)).not.toContain(item);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
