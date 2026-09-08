import { clientHeaders, expect, test } from "./fixtures";

test("substituição de responsável cobre somente itens atribuídos, sem conceder gestão da unidade", async ({
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
  const [admin, worker, substitute] = clients;
  let substitutionId = "";
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
    const template = await admin.post("/api/onboarding-templates", {
      data: {
        name: "Providências com responsável substituto",
        kind: "entry",
        active: true,
        items: [
          {
            title: "Conferir orientações",
            area: "Servidor",
            required: true,
            active: true,
          },
          {
            title: "Validar cadastro",
            area: "RH",
            required: true,
            active: true,
          },
        ],
      },
    });
    expect(template.status()).toBe(201);
    const created = await admin.post("/api/checklists", {
      data: {
        personId: users[1].person.id,
        employmentId: users[1].employment.id,
        templateId: (await template.json()).id,
        assignments: [
          { itemIndex: 0, accountId: users[1].account.id },
          { itemIndex: 1, accountId: users[0].account.id },
        ],
      },
    });
    expect(created.status()).toBe(201);
    const checklist = await created.json();
    const delegation = await admin.post("/api/substitutions", {
      data: {
        originalAccountId: users[1].account.id,
        substituteAccountId: users[2].account.id,
        unitId: users[1].employment.unit.id,
        startsOn: "2026-01-01",
        endsOn: "2040-12-31",
        reason: "Cobertura das providências durante ausência temporária.",
        flows: ["checklist.assignment"],
      },
    });
    expect(delegation.status()).toBe(201);
    substitutionId = (await delegation.json()).id;
    const item = expect.objectContaining({
      id: `checklist:${checklist.id}`,
      delegation: expect.objectContaining({ id: substitutionId }),
    });
    expect((await (await substitute.get("/api/inbox")).json()).items).toEqual(
      expect.arrayContaining([item]),
    );
    expect((await (await worker.get("/api/inbox")).json()).items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `checklist:${checklist.id}` }),
      ]),
    );
    expect((await substitute.get("/api/checklists?scope=team")).status()).toBe(
      403,
    );
    const mine = await substitute.get("/api/checklists?scope=mine");
    expect((await mine.json()).checklists).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: checklist.id })]),
    );
    const url = `/api/checklists/${checklist.id}`;
    const detail = await substitute.get(url);
    expect(detail.status()).toBe(200);
    expect(
      (await detail.json()).items.map(
        (entry: { canAct: boolean }) => entry.canAct,
      ),
    ).toEqual([true, false]);
    expect(
      (
        await substitute.post(`${url}/items/${checklist.items[1].id}`, {
          data: { action: "complete", version: 1 },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await substitute.post(`${url}/items/${checklist.items[0].id}`, {
          data: { action: "complete", version: 1 },
        })
      ).status(),
    ).toBe(200);
    const events = await (
      await admin.get("/api/audit-events?action=checklist.item-updated")
    ).json();
    expect(events.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: checklist.id,
          actor: expect.objectContaining({ accountId: users[2].account.id }),
          metadata: expect.objectContaining({
            delegation: expect.objectContaining({ id: substitutionId }),
          }),
        }),
      ]),
    );
    expect(
      (await (await substitute.get("/api/inbox")).json()).items,
    ).not.toEqual(expect.arrayContaining([item]));
    expect(
      (
        await admin.post(`/api/substitutions/${substitutionId}/cancel`, {
          data: { version: 1 },
        })
      ).status(),
    ).toBe(200);
    substitutionId = "";
    expect((await substitute.get(url)).status()).toBe(404);
  } finally {
    if (substitutionId)
      await admin.post(`/api/substitutions/${substitutionId}/cancel`, {
        data: { version: 1 },
      });
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
