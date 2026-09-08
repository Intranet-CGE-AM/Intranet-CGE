import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";

test("histórico cobre cada tipo, recusa operação sem mudança e controla concorrência", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
  });
  try {
    await api.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const { units, categories, supervisors } = await (
      await api.get("/api/employment-options")
    ).json();
    const created = await api.post("/api/people", {
      data: {
        fullName: "Histórico de todos os tipos",
        employment: {
          employeeNumber: `TYPES-${Date.now()}`,
          unitId: units[0].id,
          categoryId: categories[0].id,
          jobTitle: "Cargo inicial",
          startDate: "2020-01-01",
        },
      },
    });
    expect(created.status()).toBe(201);
    const { personId } = await created.json();
    let version = 1;
    const move = (changes: object, extra = {}) =>
      api.post(`/api/people/${personId}/movements`, {
        data: {
          expectedVersion: version,
          effectiveOn: "2026-09-07",
          reason: "Movimentação administrativa conferida",
          changes,
          ...extra,
        },
      });
    expect((await move({ jobTitle: "Cargo inicial" })).status()).toBe(400);
    const changes = [
      { jobTitle: "Cargo novo" },
      { unitId: units[1].id },
      { categoryId: categories[1].id },
      { supervisorRelationshipId: supervisors[0].id },
    ];
    for (const change of changes) {
      const result = await move(change);
      expect(result.status()).toBe(201);
      version = (await result.json()).version;
    }
    const concurrent = await Promise.all([
      move({ jobTitle: "Cargo concorrente A" }),
      move({ jobTitle: "Cargo concorrente B" }),
    ]);
    expect(concurrent.map((result) => result.status()).sort()).toEqual([
      201, 409,
    ]);
    version += 1;
    expect((await move({ endDate: "2026-09-07" })).status()).toBe(400);
    expect(
      (
        await move({ endDate: "2026-09-07" }, { confirmTermination: true })
      ).status(),
    ).toBe(201);
    const history = await (
      await api.get(`/api/people/${personId}/employment-history`)
    ).json();
    expect(
      new Set(history.movements.map((item: { type: string }) => item.type)),
    ).toEqual(
      new Set([
        "admission",
        "jobTitle",
        "unitId",
        "categoryId",
        "supervisorRelationshipId",
        "endDate",
      ]),
    );
    const original = history.movements[0];
    expect(
      (
        await api.patch(`/api/people/${personId}/movements/${original.id}`, {
          data: { reason: "Tentativa de apagar histórico" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await api.delete(`/api/people/${personId}/movements/${original.id}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await (
          await api.get(`/api/people/${personId}/employment-history`)
        ).json()
      ).movements,
    ).toEqual(history.movements);
  } finally {
    await api.dispose();
  }
});
