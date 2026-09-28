import { clientHeaders, expect, test } from "./fixtures";

test("disponibilidade compõe férias e ocorrências, com escopo atual e motivo protegido", async ({
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
  const [admin, worker, chief, other] = contexts;
  let grantId: string | undefined;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
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
    const url =
      "/api/team-availability?startDate=2036-01-01&endDate=2036-01-31";
    expect((await chief.get(url)).status()).toBe(200);
    expect((await worker.get(url)).status()).toBe(403);
    expect((await other.get(url)).status()).toBe(403);
    expect(
      (
        await chief.get(`${url}&unitId=${users[3].employment.unit.id}`)
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.get(
          "/api/team-availability?startDate=2036-01-01&endDate=2036-12-31",
        )
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.get(
          "/api/team-availability?startDate=2036-01-31&endDate=2036-01-01",
        )
      ).status(),
    ).toBe(400);
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: users[1].account.id,
        permission: "occurrences.create",
        effect: "allow",
        unitId: users[1].employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Ausência administrativa confirmada",
        active: true,
        requiresSupervisor: false,
        requiresRH: false,
        requiresDocument: false,
        affectsAvailability: true,
        documentTypeId: null,
      },
    });
    const typeId = (await type.json()).id;
    const occurrence = await worker.post("/api/occurrences", {
      data: {
        typeId,
        startDate: "2036-01-20",
        endDate: "2036-01-21",
        justification: "Informação particular que não deve ser revelada",
      },
    });
    expect(occurrence.status()).toBe(201);
    const occurrenceId = (await occurrence.json()).id;
    const vacation = await worker.post("/api/vacation-requests", {
      data: { startDate: "2036-01-02", endDate: "2036-01-05" },
    });
    expect(vacation.status()).toBe(201);
    const vacationId = (await vacation.json()).id;
    let calendar = await (await chief.get(url)).json();
    expect(calendar.absences.map((item: { id: string }) => item.id)).toEqual([
      occurrenceId,
    ]);
    expect(calendar.pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: vacationId, kind: "vacation" }),
      ]),
    );
    expect(calendar.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ personId: users[1].person.id }),
      ]),
    );
    expect(
      calendar.members.some(
        (item: { personId: string }) => item.personId === users[3].person.id,
      ),
    ).toBe(false);
    expect(calendar.absences[0].reason).toBe("Indisponível");
    expect(JSON.stringify(calendar)).not.toMatch(
      /Informação particular|documentId|justification|birthDate|notes/,
    );
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
    ).toBe(200);
    calendar = await (await chief.get(url)).json();
    expect(
      calendar.absences.map((item: { id: string }) => item.id).sort(),
    ).toEqual([occurrenceId, vacationId].sort());
    expect(
      calendar.pending.some((item: { id: string }) => item.id === vacationId),
    ).toBe(false);
    const rh = await (await admin.get(url)).json();
    expect(rh.absences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: occurrenceId,
          reason: "Ausência administrativa confirmada",
        }),
        expect.objectContaining({ id: vacationId, reason: "Férias" }),
      ]),
    );
    expect(
      (
        await worker.post(`/api/occurrences/${occurrenceId}/transition`, {
          data: { action: "cancel", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await chief.get(url)).json()).absences.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual([vacationId]);
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
