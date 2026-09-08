import { clientHeaders, expect, test } from "./fixtures";

test("quadro de cargos deriva ocupação dos vínculos ativos e preserva o cargo descritivo", async ({
  playwright,
}) => {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker] = contexts;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
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
    const unitId = users[1].employment.unit.id;
    const personResponse = await admin.post("/api/people", {
      data: {
        fullName: "Pessoa do quadro de cargos",
        employment: {
          employeeNumber: `ORG-BASE-${Date.now()}`,
          categoryId: users[1].employment.category.id,
          unitId,
          startDate: "2020-01-01",
          jobTitle: "Cargo descritivo preservado",
        },
      },
    });
    expect(personResponse.status()).toBe(201);
    const person = await personResponse.json();
    const initial = await admin.get("/api/organization");
    expect(initial.status()).toBe(200);
    expect(initial.headers()["cache-control"]).toBe("no-store");
    const view = await initial.json();
    const unit = view.units.find(
      (entry: { id: string }) => entry.id === unitId,
    );
    expect(unit.peopleCount).toBeGreaterThan(0);
    expect(unit.chiefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Helena Monteiro" }),
      ]),
    );
    const employment = unit.employments.find(
      (entry: { id: string }) => entry.id === person.employmentId,
    );
    const input = {
      unitId,
      code: "AN-TI",
      title: "Analista de tecnologia",
      plannedCount: 2,
      active: true,
    };
    expect(
      (
        await worker.post("/api/organization/positions", { data: input })
      ).status(),
    ).toBe(403);
    const created = await admin.post("/api/organization/positions", {
      data: input,
    });
    expect(created.status()).toBe(201);
    const position = await created.json();
    async function currentPosition() {
      const result = await (await admin.get("/api/organization")).json();
      return result.units
        .find((entry: { id: string }) => entry.id === unitId)
        .positions.find((entry: { id: string }) => entry.id === position.id);
    }
    expect(await currentPosition()).toMatchObject({
      plannedCount: 2,
      occupiedCount: 0,
      vacancies: 2,
    });
    const url = `/api/organization/employments/${employment.id}/position`;
    const assigned = await admin.post(url, {
      data: { positionId: position.id, version: employment.version },
    });
    expect(assigned.status()).toBe(200);
    const updated = await assigned.json();
    expect(updated).toMatchObject({
      positionId: position.id,
      jobTitle: "Cargo descritivo preservado",
    });
    expect(await currentPosition()).toMatchObject({
      plannedCount: 2,
      occupiedCount: 1,
      vacancies: 1,
    });
    const positionUrl = `/api/organization/positions/${position.id}`;
    const reduction = { ...input, plannedCount: 0, version: position.version };
    expect((await admin.put(positionUrl, { data: reduction })).status()).toBe(
      409,
    );
    expect(
      (
        await admin.put(positionUrl, {
          data: { ...reduction, confirmBelowOccupancy: true },
        })
      ).status(),
    ).toBe(200);
    expect(await currentPosition()).toMatchObject({
      plannedCount: 0,
      occupiedCount: 1,
      vacancies: -1,
      version: 2,
    });
    expect(
      (
        await admin.put(positionUrl, {
          data: { ...input, active: false, version: 2 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.post("/api/organization/positions", { data: input })
      ).status(),
    ).toBe(409);
    expect((await admin.put(positionUrl, { data: reduction })).status()).toBe(
      409,
    );
    const concurrent = await Promise.all(
      [0, 1].map(() =>
        admin.put(positionUrl, {
          data: { ...input, version: 2 },
        }),
      ),
    );
    expect(concurrent.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (
        await admin.post(url, {
          data: { positionId: null, version: employment.version },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.post(url, {
          data: { positionId: null, version: updated.version },
        })
      ).status(),
    ).toBe(200);
    expect(await currentPosition()).toMatchObject({
      plannedCount: 2,
      occupiedCount: 0,
      vacancies: 2,
    });
    const audit = await (
      await admin.get("/api/audit-events?action=organization.position-assigned")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: employment.id,
          actor: expect.objectContaining({ accountId: users[0].account.id }),
        }),
      ]),
    );
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
