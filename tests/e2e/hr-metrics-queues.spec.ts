import { clientHeaders, expect, test } from "./fixtures";

test("indicadores acompanham etapas de férias, ocorrências e validação de capacitações", async ({
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
  const grants: string[] = [];
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
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
    for (const permission of ["training.create", "occurrences.create"]) {
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[1].account.id,
          permission,
          effect: "allow",
          unitId: users[1].employment.unit.id,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
    }
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Manaus",
    });
    const url = `/api/hr-metrics?startDate=${today}&endDate=${today}&unitId=${users[1].employment.unit.id}`;
    const baseline = await (await admin.get(url)).json();
    const initialChief =
      baseline.vacations.find(
        (row: { status: string }) => row.status === "submitted",
      )?.count ?? 0;
    const initialFinal =
      baseline.vacations.find(
        (row: { status: string }) => row.status === "supervisor_approved",
      )?.count ?? 0;
    const initialOccurrence =
      baseline.occurrences.find(
        (row: { status: string }) => row.status === "submitted",
      )?.count ?? 0;
    const vacationResponse = await worker.post("/api/vacation-requests", {
      data: { startDate: "2040-08-01", endDate: "2040-08-05" },
    });
    expect(vacationResponse.status()).toBe(201);
    const vacation = await vacationResponse.json();
    expect((await (await admin.get(url)).json()).vacations).toEqual(
      expect.arrayContaining([
        { status: "submitted", count: initialChief + 1 },
      ]),
    );
    expect(
      (
        await chief.post(
          `/api/vacation-requests/${vacation.id}/supervisor-decision`,
          { data: { decision: "approve", version: 1 } },
        )
      ).status(),
    ).toBe(200);
    const afterChief = await (await admin.get(url)).json();
    expect(
      afterChief.vacations.find(
        (row: { status: string }) => row.status === "submitted",
      )?.count ?? 0,
    ).toBe(initialChief);
    expect(afterChief.vacations).toEqual(
      expect.arrayContaining([
        { status: "supervisor_approved", count: initialFinal + 1 },
      ]),
    );
    const typeResponse = await admin.post("/api/occurrence-types", {
      data: {
        name: "Ausência dos indicadores",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: false,
        affectsAvailability: true,
        documentTypeId: null,
      },
    });
    expect(typeResponse.status()).toBe(201);
    expect(
      (
        await worker.post("/api/occurrences", {
          data: {
            typeId: (await typeResponse.json()).id,
            startDate: "2040-09-01",
            endDate: "2040-09-02",
            justification: "Ausência para aferição dos indicadores",
            submit: true,
          },
        })
      ).status(),
    ).toBe(201);
    const trainingResponse = await worker.post("/api/training", {
      data: {
        title: "Formação de indicadores",
        institution: "Escola de homologação",
        startDate: "2026-06-01",
        endDate: "2026-06-02",
        hours: 8,
      },
    });
    expect(trainingResponse.status()).toBe(201);
    const training = await trainingResponse.json();
    const after = await (await admin.get(url)).json();
    expect(after.occurrences).toEqual(
      expect.arrayContaining([
        { status: "submitted", count: initialOccurrence + 1 },
      ]),
    );
    expect(after.trainingPending).toBe(baseline.trainingPending + 1);
    expect(
      (
        await admin.post(`/api/training/${training.id}/transition`, {
          data: { action: "validate", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect((await (await admin.get(url)).json()).trainingPending).toBe(
      baseline.trainingPending,
    );
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
