import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture.js";

test("titular anexa PDF à ocorrência sem ganhar publicação geral nem expor arquivo à chefia", async ({
  playwright,
}) => {
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, chief] = contexts;
  let grantId: string | undefined;
  try {
    let workerUser;
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
    ].entries()) {
      const login = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password:
            index === 0 ? "Admin-E2E-Password-123" : "Homolog-Password-2026",
        },
      });
      expect(login.status()).toBe(200);
      if (index === 1) workerUser = (await login.json()).user;
    }
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: workerUser.account.id,
        permission: "occurrences.create",
        effect: "allow",
        unitId: workerUser.employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    const documentType = await admin.post("/api/document-types", {
      data: {
        name: "Comprovante confidencial",
        purpose: "Analisar afastamento administrativo",
        retentionDays: 365,
        policyReference: "Política de homologação",
        sensitive: true,
      },
    });
    expect(documentType.status()).toBe(201);
    const { id: documentTypeId } = await documentType.json();
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Afastamento com comprovante",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: true,
        affectsAvailability: true,
        documentTypeId,
      },
    });
    expect(type.status()).toBe(201);
    const draft = await worker.post("/api/occurrences", {
      data: {
        typeId: (await type.json()).id,
        startDate: "2033-05-01",
        endDate: "2033-05-03",
        justification: "Análise de ocorrência administrativa",
        submit: false,
      },
    });
    expect(draft.status()).toBe(201);
    const occurrence = await draft.json();
    const metadata = {
      personId: workerUser.person.id,
      typeId: documentTypeId,
      title: "Comprovante da ocorrência",
      issuedOn: "2026-09-07",
      source: "Enviado pelo titular",
      occurrenceId: occurrence.id,
      occurrenceVersion: 1,
    };
    const upload = (
      context: typeof worker,
      data = metadata,
      buffer = blankPdf,
    ) =>
      context.post("/api/documents", {
        multipart: {
          metadata: JSON.stringify(data),
          file: {
            name: "comprovante.pdf",
            mimeType: "application/pdf",
            buffer,
          },
        },
      });
    const response = await upload(worker);
    expect(response.status()).toBe(201);
    const document = await response.json();
    expect(document.sensitive).toBe(true);
    expect(document).not.toHaveProperty("objectKey");
    expect(
      (await worker.get(`/api/documents/${document.id}/file`)).status(),
    ).toBe(200);
    expect(
      (await chief.get(`/api/documents/${document.id}/file`)).status(),
    ).toBe(404);
    expect((await upload(worker)).status()).toBe(409);
    expect((await upload(chief)).status()).toBe(403);
    const current = await (
      await worker.get(`/api/occurrences/${occurrence.id}`)
    ).json();
    expect(current).toMatchObject({ version: 2, documentId: document.id });
    expect(current.events.at(-1).type).toBe("document-attached");
    const invalid = await upload(
      worker,
      { ...metadata, occurrenceVersion: 2 },
      Buffer.from("%PDF-1.4\n%%EOF"),
    );
    expect(invalid.status()).toBe(400);
    expect(
      (
        await worker.post(`/api/occurrences/${occurrence.id}/transition`, {
          data: { action: "submit", version: 2 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await upload(worker, { ...metadata, occurrenceVersion: 3 })).status(),
    ).toBe(409);
    const {
      occurrenceId: ignoredId,
      occurrenceVersion: ignoredVersion,
      ...ordinary
    } = metadata;
    void ignoredId;
    void ignoredVersion;
    expect(
      (
        await worker.post("/api/documents", {
          multipart: {
            metadata: JSON.stringify(ordinary),
            file: {
              name: "comprovante.pdf",
              mimeType: "application/pdf",
              buffer: blankPdf,
            },
          },
        })
      ).status(),
    ).toBe(403);
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
