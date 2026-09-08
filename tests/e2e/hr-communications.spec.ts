import { clientHeaders, expect, test } from "./fixtures";

test("comunicado publicado alcança apenas o público ativo e registra ciência única com Markdown seguro", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1, 2, 3].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, outside, ended] = clients;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
      "renata.martins@homolog.cge.am.gov.br",
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
    const input = {
      title: "Orientações para atualização cadastral",
      summary: "Confira as orientações e confirme a leitura.",
      body: "## Orientações\n\nConfira **seus dados**.\n\n<script>alert('indevido')</script>\n\n[link inseguro](javascript:alert%281%29)",
      publicationAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2040-12-31T23:59:59.000Z",
      audience: { type: "units", ids: [users[1].employment.unit.id] },
      requiresAcknowledgment: true,
    };
    const created = await admin.post("/api/hr-communications", { data: input });
    expect(created.status()).toBe(201);
    const draft = await created.json();
    expect(draft).toMatchObject({
      status: "draft",
      version: 1,
      authorName: "Administrador da Plataforma",
    });
    expect(
      (await worker.post("/api/hr-communications", { data: input })).status(),
    ).toBe(403);
    expect(
      (await worker.get(`/api/hr-communications/${draft.id}`)).status(),
    ).toBe(404);
    const published = await admin.post(
      `/api/hr-communications/${draft.id}/publish`,
      { data: { version: 1 } },
    );
    expect(published.status()).toBe(200);
    const item = await published.json();
    expect(item).toMatchObject({ status: "published", version: 2 });
    const list = await worker.get("/api/hr-communications");
    expect(list.status()).toBe(200);
    expect(list.headers()["cache-control"]).toBe("no-store");
    expect((await list.json()).communications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: item.id, acknowledgedAt: null }),
      ]),
    );
    const detail = await (
      await worker.get(`/api/hr-communications/${item.id}`)
    ).json();
    expect(detail.bodyHtml).toContain("<strong>seus dados</strong>");
    expect(detail.bodyHtml).not.toContain("<script>");
    expect(detail.bodyHtml).not.toContain('href="javascript:');
    expect(
      (await outside.get(`/api/hr-communications/${item.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await (await outside.get("/api/hr-communications")).json()
      ).communications.map((entry: { id: string }) => entry.id),
    ).not.toContain(item.id);
    expect((await ended.get("/api/hr-communications")).status()).toBe(403);
    const ackUrl = `/api/hr-communications/${item.id}/acknowledgment`;
    const first = await worker.post(ackUrl, {
      data: { version: item.version },
    });
    expect(first.status()).toBe(200);
    const acknowledgment = await first.json();
    expect(acknowledgment.acknowledgedAt).toBeTruthy();
    expect(
      await (
        await worker.post(ackUrl, { data: { version: item.version } })
      ).json(),
    ).toEqual(acknowledgment);
    expect(
      (
        await outside.post(ackUrl, { data: { version: item.version } })
      ).status(),
    ).toBe(404);
    expect(
      await (await worker.get(`/api/hr-communications/${item.id}`)).json(),
    ).toMatchObject({ acknowledgedAt: acknowledgment.acknowledgedAt });
    const audit = await (
      await admin.get("/api/audit-events?action=hr-communication.acknowledged")
    ).json();
    expect(
      audit.events.filter(
        (event: { objectId: string }) => event.objectId === item.id,
      ),
    ).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      actor: { accountId: users[1].account.id },
    });
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
