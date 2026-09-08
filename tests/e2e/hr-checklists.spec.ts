import { clientHeaders, expect, test } from "./fixtures";

test("checklist preserva modelo, restringe responsáveis e exige justificativa para dispensa obrigatória", async ({
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
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    expect((await admin.get("/api/onboarding-templates")).status()).toBe(200);
    const input = {
      name: "Ingresso administrativo",
      kind: "entry",
      active: true,
      items: [
        {
          title: "Conferir orientações de ingresso",
          area: "Servidor",
          required: true,
          active: true,
        },
        {
          title: "Conferir documentos funcionais",
          area: "Gestão de Pessoas",
          required: true,
          active: true,
        },
      ],
    };
    expect(
      (
        await worker.post("/api/onboarding-templates", { data: input })
      ).status(),
    ).toBe(403);
    const templateResponse = await admin.post("/api/onboarding-templates", {
      data: input,
    });
    expect(templateResponse.status()).toBe(201);
    const template = await templateResponse.json();
    const executionResponse = await admin.post("/api/checklists", {
      data: {
        personId: users[1].person.id,
        employmentId: users[1].employment.id,
        templateId: template.id,
        assignments: [
          { itemIndex: 0, accountId: users[1].account.id },
          { itemIndex: 1, accountId: users[0].account.id },
        ],
      },
    });
    expect(executionResponse.status()).toBe(201);
    const execution = await executionResponse.json();
    const url = `/api/checklists/${execution.id}`;
    expect((await other.get(url)).status()).toBe(404);
    expect(
      (await (await worker.get("/api/checklists?scope=mine")).json())
        .checklists,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: execution.id })]),
    );
    expect(
      (
        await admin.put(`/api/onboarding-templates/${template.id}`, {
          data: {
            ...input,
            version: template.version,
            items: [
              { ...input.items[0], title: "Orientação alterada no modelo" },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    const snapshot = await (await worker.get(url)).json();
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0].title).toBe("Conferir orientações de ingresso");
    expect(snapshot.progress).toEqual({
      completed: 0,
      waived: 0,
      pending: 2,
      total: 2,
    });
    const itemUrl = `${url}/items/${snapshot.items[0].id}`;
    expect(
      (
        await worker.post(itemUrl, { data: { action: "waive", version: 1 } })
      ).status(),
    ).toBe(400);
    expect(
      (
        await worker.post(`${url}/items/${snapshot.items[1].id}`, {
          data: { action: "complete", version: 1 },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await worker.post(itemUrl, {
          data: {
            action: "waive",
            version: 1,
            comment: "Orientações já recebidas presencialmente.",
          },
        })
      ).status(),
    ).toBe(200);
    const decisions = await Promise.all(
      [0, 1].map(() =>
        admin.post(`${url}/items/${snapshot.items[1].id}`, {
          data: {
            action: "complete",
            version: 2,
            comment: "Documentação conferida.",
          },
        }),
      ),
    );
    expect(decisions.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    const finished = await (await worker.get(url)).json();
    expect(finished.progress).toEqual({
      completed: 1,
      waived: 1,
      pending: 0,
      total: 2,
    });
    expect(finished.items[0]).toMatchObject({
      status: "waived",
      comment: "Orientações já recebidas presencialmente.",
      completedBy: users[1].account.id,
    });
    expect(
      (
        await (
          await admin.get("/api/audit-events?action=checklist.item-updated")
        ).json()
      ).events,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: execution.id }),
      ]),
    );
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
