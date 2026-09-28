import { clientHeaders, expect, test } from "./fixtures";

test("transferência libera o cargo de origem e desligamento libera ocupação sem apagar o histórico", async ({
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  try {
    expect(
      (
        await admin.post("/api/auth/login", {
          data: {
            email: "admin-e2e@local.invalid",
            password: "Admin-E2E-Password-123",
          },
        })
      ).status(),
    ).toBe(200);
    const options = await (await admin.get("/api/employment-options")).json();
    const [origin, destination] = options.units;
    const created = await admin.post("/api/people", {
      data: {
        fullName: "Pessoa com cargo em movimentação",
        employment: {
          employeeNumber: `ORG-MOVE-${Date.now()}`,
          unitId: origin.id,
          categoryId: options.categories[0].id,
          startDate: "2020-01-01",
          jobTitle: "Cargo original preservado",
        },
      },
    });
    expect(created.status()).toBe(201);
    const person = await created.json();
    async function createPosition(unitId: string) {
      const response = await admin.post("/api/organization/positions", {
        data: {
          unitId,
          code: "MOVE",
          title: "Cargo de movimentação",
          plannedCount: 1,
          active: true,
        },
      });
      expect(response.status()).toBe(201);
      return response.json();
    }
    const [original, target] = await Promise.all([
      createPosition(origin.id),
      createPosition(destination.id),
    ]);
    const assignment = `/api/organization/employments/${person.employmentId}/position`;
    expect(
      (
        await admin.post(assignment, {
          data: { positionId: target.id, version: 1 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.post(assignment, {
          data: { positionId: original.id, version: 1 },
        })
      ).status(),
    ).toBe(200);
    const moved = await admin.post(`/api/people/${person.personId}/movements`, {
      data: {
        expectedVersion: 2,
        effectiveOn: "2026-09-08",
        reason: "Transferência entre unidades para teste de integridade",
        changes: { unitId: destination.id },
      },
    });
    expect(moved.status()).toBe(201);
    let view = await (await admin.get("/api/organization")).json();
    expect(
      view.units
        .find((unit: { id: string }) => unit.id === origin.id)
        .positions.find((job: { id: string }) => job.id === original.id),
    ).toMatchObject({ occupiedCount: 0, vacancies: 1 });
    expect(
      view.units
        .find((unit: { id: string }) => unit.id === destination.id)
        .employments.find(
          (item: { id: string }) => item.id === person.employmentId,
        ),
    ).toMatchObject({
      positionId: null,
      jobTitle: "Cargo original preservado",
      version: 3,
    });
    expect(
      (
        await admin.post(assignment, {
          data: { positionId: target.id, version: 3 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post(`/api/people/${person.personId}/movements`, {
          data: {
            expectedVersion: 4,
            effectiveOn: "2026-09-08",
            reason: "Encerramento do vínculo para verificar ocupação",
            changes: { endDate: "2026-09-08" },
            confirmTermination: true,
          },
        })
      ).status(),
    ).toBe(201);
    view = await (await admin.get("/api/organization")).json();
    const unit = view.units.find(
      (item: { id: string }) => item.id === destination.id,
    );
    expect(
      unit.positions.find((job: { id: string }) => job.id === target.id),
    ).toMatchObject({ occupiedCount: 0, vacancies: 1 });
    expect(
      unit.employments.map((item: { id: string }) => item.id),
    ).not.toContain(person.employmentId);
    expect(
      (
        await admin.put(`/api/organization/positions/${target.id}`, {
          data: {
            unitId: destination.id,
            code: "MOVE",
            title: "Cargo de movimentação",
            plannedCount: 1,
            active: false,
            version: 1,
          },
        })
      ).status(),
    ).toBe(200);
    const audit = await (
      await admin.get("/api/audit-events?action=employment.moved")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: person.employmentId,
          metadata: expect.objectContaining({
            releasedPositionId: original.id,
          }),
        }),
      ]),
    );
  } finally {
    await admin.dispose();
  }
});
