import type { APIRequestContext } from "@playwright/test";

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
async function inbox(client: APIRequestContext) {
  const response = await client.get("/api/inbox?type=audit_document");
  expect(response.status()).toBe(200);
  return ((await response.json()).items as { id: string }[]).map(
    (item) => item.id,
  );
}

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
