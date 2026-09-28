import { clientHeaders, expect, test } from "./fixtures";

test("gestor de checklist só encontra vínculos e responsáveis autorizados", async ({
  playwright,
}) => {
  const contexts = await Promise.all(
    [0, 1, 2, 3].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, chief, worker, other] = contexts;
  let overrideId: string | undefined;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "helena.monteiro@homolog.cge.am.gov.br",
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
    expect((await worker.get("/api/checklist-people")).status()).toBe(403);
    expect((await worker.get("/api/checklist-assignees")).status()).toBe(403);
    const override = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: users[1].account.id,
        permission: "onboarding.manage",
        effect: "allow",
        unitId: users[2].employment.unit.id,
      },
    });
    expect(override.status()).toBe(201);
    overrideId = (await override.json()).id;
    const people = await chief.get("/api/checklist-people");
    expect(people.status()).toBe(200);
    expect(people.headers()["cache-control"]).toBe("no-store");
    expect((await people.json()).people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ employmentId: users[2].employment.id }),
      ]),
    );
    expect((await people.json()).people).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ employmentId: users[3].employment.id }),
      ]),
    );
    const accounts = (
      await (await chief.get("/api/checklist-assignees")).json()
    ).accounts;
    expect(accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: users[2].account.id }),
      ]),
    );
    expect(accounts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: users[3].account.id }),
      ]),
    );
    const template = await admin.post("/api/onboarding-templates", {
      data: {
        name: "Checklist de escopo",
        kind: "entry",
        active: true,
        items: [
          {
            title: "Orientar ingresso",
            area: "RH",
            required: true,
            active: true,
          },
        ],
      },
    });
    expect(template.status()).toBe(201);
    const templateId = (await template.json()).id;
    const input = {
      templateId,
      personId: users[2].person.id,
      employmentId: users[2].employment.id,
      assignments: [{ itemIndex: 0, accountId: users[2].account.id }],
    };
    expect(
      (
        await chief.post("/api/checklists", {
          data: {
            ...input,
            personId: users[3].person.id,
            employmentId: users[3].employment.id,
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await chief.post("/api/checklists", {
          data: {
            ...input,
            assignments: [{ itemIndex: 0, accountId: users[3].account.id }],
          },
        })
      ).status(),
    ).toBe(400);
    const created = await chief.post("/api/checklists", { data: input });
    expect(created.status()).toBe(201);
    const execution = await created.json();
    expect((await other.get(`/api/checklists/${execution.id}`)).status()).toBe(
      404,
    );
    expect(
      (
        await admin.delete(`/api/admin/permission-overrides/${overrideId}`)
      ).status(),
    ).toBe(204);
    overrideId = undefined;
    expect((await chief.get("/api/checklists?scope=team")).status()).toBe(403);
    expect(
      (
        await chief.post(
          `/api/checklists/${execution.id}/items/${execution.items[0].id}`,
          { data: { action: "complete", version: 1 } },
        )
      ).status(),
    ).toBe(404);
    expect((await worker.get(`/api/checklists/${execution.id}`)).status()).toBe(
      200,
    );
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
