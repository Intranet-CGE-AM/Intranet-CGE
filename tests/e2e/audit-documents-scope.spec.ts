import { auditRows, detail } from "./audit-document-api";
import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxFile,
  signIn,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test } from "./fixtures";

test("documentos de auditoria ficam restritos à equipe autorizada", async ({
  playwright,
  baseURL,
}) => {
  const coordinatorB = await signIn(
    playwright,
    baseURL!,
    auditAccounts.coordinatorB,
  );
  const assessorA = await signIn(playwright, baseURL!, auditAccounts.assessorA);
  const admin = await signIn(playwright, baseURL!, auditAccounts.admin);
  try {
    const teamB = await unitId(coordinatorB, auditTeams.b);
    const created = await createDocument(
      coordinatorB,
      { unitId: teamB, title: `Relatório da equipe B E2E ${Date.now()}` },
      docxFile(),
    );
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const fileId = (
      await (await coordinatorB.get(`/api/audit-documents/${id}`)).json()
    ).files[0].id;

    const options = await (
      await assessorA.get("/api/audit-documents/options")
    ).json();
    expect(options.units.map((unit: { name: string }) => unit.name)).toEqual([
      auditTeams.a,
    ]);
    const list = await (await assessorA.get("/api/audit-documents")).json();
    expect(list.documents.map((item: { id: string }) => item.id)).not.toContain(
      id,
    );
    expect(
      (await assessorA.get(`/api/audit-documents?unitId=${teamB}`)).status(),
    ).toBe(403);
    for (const response of [
      await assessorA.get(`/api/audit-documents/${id}`),
      await assessorA.get(`/api/audit-documents/${id}/files/${fileId}`),
      await assessorA.post(`/api/audit-documents/${id}/transition`, {
        data: { action: "cancel", version: 1, message: "Fora do escopo." },
      }),
      await uploadVersion(assessorA, id, { version: 1 }, docxFile()),
    ])
      expect(response.status()).toBe(404);
    expect(
      (
        await createDocument(
          assessorA,
          { unitId: teamB, title: "Envio para outra equipe" },
          docxFile(),
        )
      ).status(),
    ).toBe(403);

    const denied = await auditRows(admin, id, { outcome: "denied" });
    expect(denied.map((event) => event.action)).toEqual(
      Array(4).fill("audit-document.access-denied"),
    );
    expect(await detail(coordinatorB, id)).toMatchObject({
      version: 1,
      fileCount: 1,
    });
  } finally {
    await Promise.all(
      [coordinatorB, assessorA, admin].map((client) => client.dispose()),
    );
  }
});

test("conta sem permissões de auditoria recebe 403", async ({
  playwright,
  baseURL,
}) => {
  const client = await signIn(playwright, baseURL!, auditAccounts.noAccess);
  try {
    for (const path of [
      "/api/audit-documents",
      "/api/audit-documents/options",
      "/api/audit-documents/settings",
    ])
      expect((await client.get(path)).status()).toBe(403);
  } finally {
    await client.dispose();
  }
});

test("assessoria envia documento, mas não aprova", async ({
  playwright,
  baseURL,
}) => {
  const assessor = await signIn(playwright, baseURL!, auditAccounts.assessorA);
  try {
    const teamA = await unitId(assessor, auditTeams.a);
    const created = await createDocument(
      assessor,
      { unitId: teamA, title: "Papel de trabalho da assessoria E2E" },
      docxFile(),
    );
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const detail = await (
      await assessor.get(`/api/audit-documents/${id}`)
    ).json();
    expect(detail.allowedActions).toEqual(["submit_version", "cancel"]);
    expect(
      (
        await assessor.post(`/api/audit-documents/${id}/transition`, {
          data: { action: "approve", version: 1 },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await assessor.put("/api/audit-documents/settings", {
          data: { bottleneckRounds: 5 },
        })
      ).status(),
    ).toBe(403);
    const cancelled = await assessor.post(
      `/api/audit-documents/${id}/transition`,
      {
        data: { action: "cancel", version: 1, message: "Enviado por engano." },
      },
    );
    expect(cancelled.status()).toBe(200);
    expect((await cancelled.json()).status).toBe("cancelled");
  } finally {
    await assessor.dispose();
  }
});
