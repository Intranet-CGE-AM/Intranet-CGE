import { clientHeaders, expect, test } from "./fixtures";

test("caixa deriva pendências acionáveis e remove demanda respondida ou complemento enviado", async ({
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
  const [admin, worker, other] = contexts;
  let overrideId: string | undefined;
  try {
    expect((await admin.get("/api/inbox")).status()).toBe(401);
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
    ].entries()) {
      const login = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(login.status()).toBe(200);
      users.push((await login.json()).user);
    }
    const override = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: users[1].account.id,
        permission: "hr_requests.create",
        effect: "allow",
        unitId: users[1].employment.unit.id,
      },
    });
    expect(override.status()).toBe(201);
    overrideId = (await override.json()).id;
    const created = await worker.post("/api/hr-requests", {
      data: {
        type: "other",
        description:
          "Conteúdo privado que não deve ser replicado na caixa de pendências.",
      },
    });
    expect(created.status()).toBe(201);
    const record = await created.json();
    const initial = await admin.get("/api/inbox");
    expect(initial.status()).toBe(200);
    expect(initial.headers()["cache-control"]).toBe("no-store");
    const inbox = await initial.json();
    expect(inbox.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `request:${record.id}`,
          type: "request",
          href: `/rh/solicitacoes?scope=team&requestId=${record.id}`,
          priority: "normal",
        }),
      ]),
    );
    expect(JSON.stringify(inbox)).not.toContain("Conteúdo privado");
    expect(
      new Set(inbox.items.map((item: { id: string }) => item.id)).size,
    ).toBe(inbox.items.length);
    expect(inbox.total).toBe(inbox.items.length);
    expect(inbox.sourcesUnavailable).toEqual([]);
    expect((await (await other.get("/api/inbox")).json()).items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `request:${record.id}` }),
      ]),
    );
    expect(
      (
        await admin.post(`/api/hr-requests/${record.id}/transition`, {
          data: { action: "start", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post(`/api/hr-requests/${record.id}/transition`, {
          data: {
            action: "request_information",
            version: 2,
            message: "Envie a referência interna.",
            deadline: "2040-01-01",
          },
        })
      ).status(),
    ).toBe(200);
    const mine = await (await worker.get("/api/inbox?type=request")).json();
    expect(mine.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `request:${record.id}`,
          title: "Enviar complemento ao RH",
          href: `/rh/solicitacoes?requestId=${record.id}`,
        }),
      ]),
    );
    expect(
      (await (await admin.get("/api/inbox?type=request")).json()).items,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `request:${record.id}` }),
      ]),
    );
    expect(
      (
        await worker.post(`/api/hr-requests/${record.id}/transition`, {
          data: {
            action: "provide_information",
            version: 3,
            message: "Referência administrativa enviada.",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await worker.get("/api/inbox?type=request")).json()).items,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `request:${record.id}` }),
      ]),
    );
    expect(
      (
        await admin.post(`/api/hr-requests/${record.id}/transition`, {
          data: {
            action: "complete",
            version: 4,
            message: "Atendimento finalizado.",
          },
        })
      ).status(),
    ).toBe(200);
    expect((await (await admin.get("/api/inbox")).json()).items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `request:${record.id}` }),
      ]),
    );
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
