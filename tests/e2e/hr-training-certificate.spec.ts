import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture.js";

test("certificado e capacitação são enviados juntos com política e acesso documental privado", async ({
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
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
    ].entries()) {
      const result = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(result.status()).toBe(200);
      users.push((await result.json()).user);
    }
    expect((await admin.get("/api/training-settings")).status()).toBe(200);
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: users[1].account.id,
        permission: "training.create",
        effect: "allow",
        unitId: users[1].employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    const input = {
      title: "Capacitação com certificado privado",
      institution: "Instituição de homologação",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      hours: 7.5,
    };
    const upload = (buffer = blankPdf, mimeType = "application/pdf") =>
      worker.post("/api/training", {
        multipart: {
          metadata: JSON.stringify(input),
          file: { name: "certificado.pdf", mimeType, buffer },
        },
      });
    expect(
      (
        await admin.put("/api/training-settings", {
          data: { certificateTypeId: null },
        })
      ).status(),
    ).toBe(200);
    expect((await upload()).status()).toBe(409);
    const type = await admin.post("/api/document-types", {
      data: {
        name: "Certificados de capacitação",
        purpose: "Validar histórico de capacitações",
        policyReference: "Política documental de homologação",
        retentionDays: 365,
        sensitive: false,
      },
    });
    expect(type.status()).toBe(201);
    const typeId = (await type.json()).id;
    expect(
      (
        await worker.put("/api/training-settings", {
          data: { certificateTypeId: typeId },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.put("/api/training-settings", {
          data: { certificateTypeId: typeId },
        })
      ).status(),
    ).toBe(200);
    expect((await upload(Buffer.from("%PDF-1.4\n%%EOF"))).status()).toBe(400);
    expect((await upload(blankPdf, "text/plain")).status()).toBe(400);
    const before = await (await worker.get("/api/training?scope=mine")).json();
    expect(
      before.records.some(
        (row: { title: string }) => row.title === input.title,
      ),
    ).toBe(false);
    const result = await upload();
    expect(result.status()).toBe(201);
    const record = await result.json();
    expect(record).toMatchObject({ status: "submitted", hours: 7.5 });
    expect(record.certificateId).toEqual(expect.any(String));
    expect(record).not.toHaveProperty("objectKey");
    const file = await worker.get(
      `/api/documents/${record.certificateId}/file`,
    );
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toContain("application/pdf");
    expect(
      (await chief.get(`/api/documents/${record.certificateId}/file`)).status(),
    ).toBe(404);
    const documents = await (await worker.get("/api/me/documents")).json();
    expect(documents.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: record.certificateId,
          typeId,
          policyReference: "Política documental de homologação",
        }),
      ]),
    );
    expect(
      (
        await admin.post(`/api/training/${record.id}/transition`, {
          data: { action: "validate", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await worker.get("/api/training?scope=validated")).json())
        .records,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: record.id,
          certificateId: record.certificateId,
        }),
      ]),
    );
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await admin.put("/api/training-settings", {
      data: { certificateTypeId: null },
    });
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
