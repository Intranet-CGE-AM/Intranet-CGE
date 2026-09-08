import { clientHeaders, expect, test } from "./fixtures";
import { buildApp } from "../../apps/api/src/app.js";
import { createDatabase } from "../../apps/api/src/db/client.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { AccessService } from "../../apps/api/src/modules/access/service.js";
import { LocalAuthenticationService } from "../../apps/api/src/modules/auth/service.js";
import { PeopleService } from "../../apps/api/src/modules/people/service.js";
import { blankPdf } from "./pdf-fixture.js";

test("falha de storage ou FK não publica capacitação nem certificado parcial", async ({
  playwright,
}) => {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e",
    SESSION_SECRET: "training-test-secret-at-least-32-characters",
    WEB_ORIGIN: "http://127.0.0.1:4173",
  });
  const { client, db } = createDatabase(config.DATABASE_URL);
  const access = new AccessService(db);
  const objects = new Set<string>();
  let mode = "storage";
  let typeId = "";
  const app = await buildApp({
    config,
    db,
    accessService: access,
    authenticationService: new LocalAuthenticationService(db, 12, (id) =>
      access.resolvePermissions(id),
    ),
    peopleService: new PeopleService(db),
    readinessCheck: async () => {},
    objectStorage: {
      ensureReady: async () => {},
      get: async () => null,
      put: async (key) => {
        objects.add(key);
        if (mode === "storage")
          throw new Error("Falha externa após gravação parcial");
        // Simula remoção concorrente da política; a FK real deve abortar toda a transação.
        await client`update training_settings set certificate_type_id = null`;
        await client`delete from document_types where id = ${typeId}`;
      },
      delete: async (key) => {
        objects.delete(key);
      },
    },
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const admin = await playwright.request.newContext({
    baseURL: address,
    extraHTTPHeaders: clientHeaders(),
  });
  const worker = await playwright.request.newContext({
    baseURL: address,
    extraHTTPHeaders: clientHeaders(),
  });
  let grantId: string | undefined;
  try {
    expect(
      (
        await admin.post("/api/auth/login", {
          data: {
            email: "admin-e2e@local.invalid",
            password: "Admin-E2E-Password-123",
          },
        })
      ).status(),
    ).toBe(200);
    const login = await worker.post("/api/auth/login", {
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    expect(login.status()).toBe(200);
    const { user } = await login.json();
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: user.account.id,
        permission: "training.create",
        effect: "allow",
        unitId: user.employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    for (const failure of ["storage", "database"]) {
      mode = failure;
      const policy = await admin.post("/api/document-types", {
        data: {
          name: `Certificado atômico ${failure}`,
          purpose: "Conferência de certificados",
          policyReference: "Política E2E",
          retentionDays: 180,
          sensitive: false,
        },
      });
      expect(policy.status()).toBe(201);
      typeId = (await policy.json()).id;
      expect(
        (
          await admin.put("/api/training-settings", {
            data: { certificateTypeId: typeId },
          })
        ).status(),
      ).toBe(200);
      const title = `Capacitação sem gravação parcial ${failure}`;
      const response = await worker.post("/api/training", {
        multipart: {
          metadata: JSON.stringify({
            title,
            institution: "Instituição E2E",
            startDate: "2026-07-01",
            endDate: "2026-07-02",
            hours: 8,
          }),
          file: {
            name: "certificado.pdf",
            mimeType: "application/pdf",
            buffer: blankPdf,
          },
        },
      });
      expect(response.status()).toBe(500);
      expect(
        (
          await (await worker.get("/api/training?scope=mine")).json()
        ).records.some((row: { title: string }) => row.title === title),
      ).toBe(false);
      expect(
        (await (await worker.get("/api/me/documents")).json()).documents.some(
          (row: { title: string }) => row.title === `Certificado: ${title}`,
        ),
      ).toBe(false);
      expect(objects.size).toBe(0);
    }
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await admin.put("/api/training-settings", {
      data: { certificateTypeId: null },
    });
    await admin.dispose();
    await worker.dispose();
    await app.close();
    await client.end();
  }
});
