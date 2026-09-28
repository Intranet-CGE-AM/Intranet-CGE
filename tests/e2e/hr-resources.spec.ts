import { clientHeaders, expect, test } from "./fixtures";

test("biblioteca publica recurso HTTPS com vigência, responsável, busca e público autorizado", async ({
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
  const [admin, worker, outside] = clients;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
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
      type: "external_link",
      title: "Orientações de uso da intranet",
      summary: "Guia de consulta para atualizar informações internas.",
      category: "Autosserviço",
      responsibleName: "Gestão de Pessoas",
      validFrom: "2026-01-01",
      validUntil: "2040-12-31",
      audience: { type: "units", ids: [users[1].employment.unit.id] },
      requiresAcknowledgment: false,
      externalUrl: "https://www.cge.am.gov.br/",
    };
    const created = await admin.post("/api/hr-resources", { data: input });
    expect(created.status()).toBe(201);
    const item = await created.json();
    expect(item).toMatchObject({ ...input, version: 1, status: "published" });
    expect(item).not.toHaveProperty("objectKey");
    expect(
      (await worker.post("/api/hr-resources", { data: input })).status(),
    ).toBe(403);
    const detail = await worker.get(`/api/hr-resources/${item.id}`);
    expect(detail.status()).toBe(200);
    expect(detail.headers()["cache-control"]).toBe("no-store");
    expect(await detail.json()).toMatchObject({
      id: item.id,
      responsibleName: "Gestão de Pessoas",
      externalUrl: input.externalUrl,
    });
    for (const term of ["Orientações", "atualizar", "Autosserviço"]) {
      const result = await worker.get(
        `/api/hr-resources?query=${encodeURIComponent(term)}&type=external_link`,
      );
      expect(result.status()).toBe(200);
      expect((await result.json()).resources).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: item.id })]),
      );
    }
    expect(
      (
        await (await worker.get("/api/hr-resources?type=policy")).json()
      ).resources.map((value: { id: string }) => value.id),
    ).not.toContain(item.id);
    expect((await outside.get(`/api/hr-resources/${item.id}`)).status()).toBe(
      404,
    );
    expect(
      (await (await outside.get("/api/hr-resources")).json()).resources.map(
        (value: { id: string }) => value.id,
      ),
    ).not.toContain(item.id);
    expect((await worker.get("/api/hr-resources?manage=true")).status()).toBe(
      403,
    );
    for (const data of [
      { ...input, externalUrl: "http://example.com" },
      { ...input, externalUrl: "javascript:alert(1)" },
      { ...input, validUntil: "2020-01-01" },
      {
        ...input,
        audience: {
          type: "units",
          ids: ["00000000-0000-4000-8000-000000000001"],
        },
      },
      { ...input, version: 99 },
    ]) {
      expect((await admin.post("/api/hr-resources", { data })).status()).toBe(
        400,
      );
    }
    const audit = await (
      await admin.get("/api/audit-events?action=hr-resource.published")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: item.id,
          actor: expect.objectContaining({ accountId: users[0].account.id }),
        }),
      ]),
    );
  } finally {
    await Promise.all(clients.map((context) => context.dispose()));
  }
});
