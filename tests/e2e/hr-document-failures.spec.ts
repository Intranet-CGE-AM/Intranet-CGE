import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";
import { buildApp } from "../../apps/api/src/app.js";
import { createDatabase } from "../../apps/api/src/db/client.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { AccessService } from "../../apps/api/src/modules/access/service.js";
import { LocalAuthenticationService } from "../../apps/api/src/modules/auth/service.js";
import { PeopleService } from "../../apps/api/src/modules/people/service.js";
import { blankPdf } from "./pdf-fixture.js";

test("falhas de storage e banco não deixam documento ou objeto órfão", async ({
  playwright,
}) => {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e",
    SESSION_SECRET: "document-test-secret-at-least-32-characters",
    WEB_ORIGIN: "http://127.0.0.1:4173",
  });
  const { client, db } = createDatabase(config.DATABASE_URL);
  const accessService = new AccessService(db);
  let failStorage = true;
  let typeId = "";
  const objects = new Set<string>();
  const deleted: string[] = [];
  const app = await buildApp({
    config,
    db,
    accessService,
    authenticationService: new LocalAuthenticationService(db, 12, (id) =>
      accessService.resolvePermissions(id),
    ),
    peopleService: new PeopleService(db),
    readinessCheck: async () => {},
    objectStorage: {
      ensureReady: async () => {},
      get: async () => null,
      put: async (key) => {
        if (failStorage) throw new Error("Falha externa de storage simulada");
        objects.add(key);
        // Exclusão concorrente do tipo provoca uma falha real de FK após o upload.
        await client`delete from document_types where id = ${typeId}`;
      },
      delete: async (key) => {
        objects.delete(key);
        deleted.push(key);
      },
    },
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const api = await playwright.request.newContext({
    baseURL: address,
    extraHTTPHeaders: { ...clientHeaders(), Origin: config.WEB_ORIGIN },
  });
  try {
    const login = await api.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    expect(login.status()).toBe(200);
    const candidates = await api.get("/api/document-people?query=Caio");
    const {
      people: [person],
    } = await candidates.json();
    expect(person).toBeTruthy();
    const type = await api.post("/api/document-types", {
      data: {
        name: "Tipo compensação",
        purpose: "Teste de compensação E2E",
        policyReference: "Política E2E",
        retentionDays: 30,
        sensitive: false,
      },
    });
    expect(type.status()).toBe(201);
    typeId = (await type.json()).id;
    for (const storageFails of [true, false]) {
      failStorage = storageFails;
      const response = await api.post("/api/documents", {
        multipart: {
          metadata: JSON.stringify({
            personId: person.id,
            typeId,
            title: "Documento não persistido",
            issuedOn: "2026-09-07",
            source: "Teste E2E",
          }),
          file: {
            name: "documento.pdf",
            mimeType: "application/pdf",
            buffer: blankPdf,
          },
        },
      });
      expect(response.status()).toBe(500);
      const listed = await api.get(`/api/documents?personId=${person.id}`);
      expect(listed.status()).toBe(200);
      expect(
        (await listed.json()).documents.filter(
          (item: { typeId: string }) => item.typeId === typeId,
        ),
      ).toHaveLength(0);
      expect(objects.size).toBe(0);
    }
    expect(deleted).toHaveLength(2);
  } finally {
    await api.dispose();
    await app.close();
    await client.end();
  }
});
