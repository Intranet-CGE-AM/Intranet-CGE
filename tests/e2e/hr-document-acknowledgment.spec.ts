import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture";

test("documento com ciência notifica apenas titular e registra confirmação idempotente", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, other] = clients;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await clients[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    const typeResponse = await admin.post("/api/document-types", {
      data: {
        name: "Declaração com ciência",
        purpose: "Comprovar entrega ao titular",
        policyReference: "Política documental E2E",
        retentionDays: 365,
        sensitive: true,
      },
    });
    expect(typeResponse.status()).toBe(201);
    const metadata = {
      personId: users[1].person.id,
      typeId: (await typeResponse.json()).id,
      title: "Conteúdo reservado do titular",
      issuedOn: "2026-01-01",
      source: "Gestão de Pessoas",
      requiresAcknowledgment: true,
    };
    const response = await admin.post("/api/documents", {
      multipart: {
        metadata: JSON.stringify(metadata),
        file: {
          name: "termo.pdf",
          mimeType: "application/pdf",
          buffer: blankPdf,
        },
      },
    });
    expect(response.status()).toBe(201);
    const document = await response.json();
    expect(document).toMatchObject({
      requiresAcknowledgment: true,
      acknowledgedAt: null,
      acknowledgedByAccountId: null,
    });
    const notices = (
      await (await worker.get("/api/notifications")).json()
    ).notifications.filter(
      (item: { type: string }) =>
        item.type === "document.acknowledgment-required",
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      title: "Documento disponível para ciência",
      message: "Consulte seus documentos na intranet.",
      href: "/rh/meu-dossie",
    });
    expect(JSON.stringify(notices)).not.toContain(metadata.title);
    expect(
      (
        await other.post(`/api/documents/${document.id}/acknowledgment`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await admin.post(`/api/documents/${document.id}/acknowledgment`)
      ).status(),
    ).toBe(404);
    const confirm = () =>
      worker.post(`/api/documents/${document.id}/acknowledgment`);
    const results = await Promise.all([confirm(), confirm()]);
    expect(results.map((item) => item.status())).toEqual([200, 200]);
    const acknowledgment = await results[0].json();
    expect(acknowledgment.acknowledgedAt).toBeTruthy();
    expect(await results[1].json()).toEqual(acknowledgment);
    const mine = (
      await (await worker.get("/api/me/documents")).json()
    ).documents.find((item: { id: string }) => item.id === document.id);
    expect(mine).toMatchObject({
      acknowledgedByAccountId: users[1].account.id,
      acknowledgedAt: acknowledgment.acknowledgedAt,
    });
    expect(
      (await admin.post(`/api/documents/${document.id}/archive`)).status(),
    ).toBe(204);
    expect((await confirm()).status()).toBe(404);
    const audit = await (
      await admin.get(`/api/audit-events?objectId=${document.id}`)
    ).json();
    expect(
      audit.events.filter(
        (item: { action: string }) => item.action === "document.acknowledged",
      ),
    ).toHaveLength(1);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
