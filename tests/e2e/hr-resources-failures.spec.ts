import { clientHeaders, expect, test } from "./fixtures";
import { buildApp } from "../../apps/api/src/app.js";
import { createDatabase } from "../../apps/api/src/db/client.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { AccessService } from "../../apps/api/src/modules/access/service.js";
import { LocalAuthenticationService } from "../../apps/api/src/modules/auth/service.js";
import { blankPdf } from "./pdf-fixture";

test("biblioteca remove upload parcial e reverte publicação quando storage ou banco falha", async ({
  playwright,
}) => {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e",
    SESSION_SECRET: "resource-test-secret-at-least-32-characters",
    WEB_ORIGIN: "http://127.0.0.1:4173",
  });
  const { db, client } = createDatabase(config.DATABASE_URL);
  const access = new AccessService(db);
  let failStorage = true;
  const objects = new Set<string>();
  const app = await buildApp({
    config,
    db,
    accessService: access,
    authenticationService: new LocalAuthenticationService(db, 12, (id) =>
      access.resolvePermissions(id),
    ),
    readinessCheck: async () => {},
    objectStorage: {
      ensureReady: async () => {},
      get: async () => null,
      put: async (key) => {
        objects.add(key);
        if (failStorage) throw new Error("Falha externa após gravação parcial");
      },
      delete: async (key) => {
        objects.delete(key);
      },
    },
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const api = await playwright.request.newContext({
    baseURL: address,
    extraHTTPHeaders: clientHeaders(),
  });
  try {
    expect(
      (
        await api.post("/api/auth/login", {
          data: {
            email: "admin-e2e@local.invalid",
            password: "Admin-E2E-Password-123",
          },
        })
      ).status(),
    ).toBe(200);
    // Falha real da fronteira de persistência no banco isolado; resultados verificados por HTTP.
    await client`alter table hr_resources add constraint hr_resources_e2e_rejected_title check (title <> 'Recurso de falha controlada')`;
    for (const storageFails of [true, false]) {
      failStorage = storageFails;
      const response = await api.post("/api/hr-resources", {
        multipart: {
          metadata: JSON.stringify({
            type: "policy",
            title: "Recurso de falha controlada",
            summary: "Publicação não deve sobreviver a falha externa.",
            category: "Políticas",
            responsibleName: "Gestão de Pessoas",
            validFrom: "2026-01-01",
            validUntil: "2040-12-31",
            audience: { type: "all" },
            externalUrl: null,
            requiresAcknowledgment: false,
          }),
          file: {
            name: "politica.pdf",
            mimeType: "application/pdf",
            buffer: blankPdf,
          },
        },
      });
      expect(response.status()).toBe(500);
      const list = await api.get(
        "/api/hr-resources?manage=true&query=Recurso%20de%20falha%20controlada",
      );
      expect(list.status()).toBe(200);
      expect((await list.json()).resources).toEqual([]);
      expect(objects.size).toBe(0);
    }
  } finally {
    await client`alter table hr_resources drop constraint if exists hr_resources_e2e_rejected_title`;
    await api.dispose();
    await app.close();
    await client.end();
  }
});
