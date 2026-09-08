import { clientHeaders, expect, test } from "./fixtures";

test("férias e ocorrências não confirmam períodos sobrepostos mesmo em concorrência", async ({
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
  const [admin, worker, chief] = contexts;
  let grantId: string | undefined;
  try {
    let workerUser;
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password:
            index === 0 ? "Admin-E2E-Password-123" : "Homolog-Password-2026",
        },
      });
      expect(response.status()).toBe(200);
      if (index === 1) workerUser = (await response.json()).user;
    }
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: workerUser.account.id,
        permission: "occurrences.create",
        effect: "allow",
        unitId: workerUser.employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Registro de ausência aprovado automaticamente",
        active: true,
        requiresSupervisor: false,
        requiresRH: false,
        requiresDocument: false,
        affectsAvailability: true,
        documentTypeId: null,
      },
    });
    expect(type.status()).toBe(201);
    const { id: typeId } = await type.json();
    const period = { startDate: "2032-06-10", endDate: "2032-06-15" };
    const create = (extra = {}) =>
      worker.post("/api/occurrences", {
        data: {
          typeId,
          ...period,
          justification: "Registro administrativo de homologação",
          ...extra,
        },
      });
    const simultaneous = await Promise.all([create(), create()]);
    expect(simultaneous.map((response) => response.status()).sort()).toEqual([
      201, 409,
    ]);
    const approved = await simultaneous
      .find((response) => response.status() === 201)!
      .json();
    const draft = await create({ submit: false });
    expect(draft.status()).toBe(201);
    expect(
      (
        await worker.post(
          `/api/occurrences/${(await draft.json()).id}/transition`,
          { data: { action: "submit", version: 1 } },
        )
      ).status(),
    ).toBe(409);
    const vacation = await worker.post("/api/vacation-requests", {
      data: period,
    });
    expect(vacation.status()).toBe(201);
    const { id: vacationId } = await vacation.json();
    expect(
      (
        await chief.post(
          `/api/vacation-requests/${vacationId}/supervisor-decision`,
          { data: { decision: "approve", version: 1 } },
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post(`/api/vacation-requests/${vacationId}/hr-decision`, {
          data: { decision: "approve", version: 2 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await worker.post(`/api/occurrences/${approved.id}/transition`, {
          data: { action: "cancel", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post(`/api/vacation-requests/${vacationId}/hr-decision`, {
          data: { decision: "approve", version: 2 },
        })
      ).status(),
    ).toBe(200);
    const conflict = await create();
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).message).toMatch(/período|sobrepo/i);
    expect(
      (
        await admin.put(`/api/occurrence-types/${typeId}`, {
          data: {
            name: "Ausência com análise",
            active: true,
            requiresSupervisor: true,
            requiresRH: true,
            requiresDocument: false,
            affectsAvailability: true,
            documentTypeId: null,
          },
        })
      ).status(),
    ).toBe(200);
    // The conflict must be reported when sending, not only at final approval.
    expect((await create()).status()).toBe(409);
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
