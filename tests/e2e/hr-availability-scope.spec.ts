import { clientHeaders, expect, test } from "./fixtures";

test("disponibilidade respeita RH por unidade, equipe atual e ocorrências sem afastamento", async ({
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
  const [admin, worker, chief, scopedHR] = contexts;
  const grants: string[] = [];
  let restore: (() => Promise<void>) | undefined;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
    ].entries()) {
      const result = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(result.status()).toBe(200);
      users.push((await result.json()).user);
    }
    for (const [index, permission] of [
      [1, "occurrences.create"],
      [2, "occurrences.review.supervisor"],
      [3, "people.manage"],
    ] as const) {
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[index].account.id,
          permission,
          effect: "allow",
          unitId: users[index].employment.unit.id,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
    }
    const url =
      "/api/team-availability?startDate=2038-05-01&endDate=2038-05-31";
    const restricted = await (await scopedHR.get(url)).json();
    expect(restricted.units).toEqual([
      { id: users[3].employment.unit.id, name: users[3].employment.unit.name },
    ]);
    expect(
      restricted.members.every(
        (item: { unitId: string }) =>
          item.unitId === users[3].employment.unit.id,
      ),
    ).toBe(true);
    expect(
      (
        await scopedHR.get(`${url}&unitId=${users[1].employment.unit.id}`)
      ).status(),
    ).toBe(403);
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Registro sem indisponibilidade",
        active: true,
        requiresSupervisor: false,
        requiresRH: false,
        requiresDocument: false,
        affectsAvailability: false,
        documentTypeId: null,
      },
    });
    expect(type.status()).toBe(201);
    const typeId = (await type.json()).id;
    expect(
      (
        await worker.post("/api/occurrences", {
          data: {
            typeId,
            startDate: "2038-05-10",
            endDate: "2038-05-10",
            justification: "Registro administrativo sem ausência",
          },
        })
      ).status(),
    ).toBe(201);
    expect((await (await chief.get(url)).json()).absences).toEqual([]);
    const historyUrl = `/api/people/${users[1].person.id}/employment-history`;
    const setChief = async (supervisorRelationshipId: string) => {
      const history = await (await admin.get(historyUrl)).json();
      expect(
        (
          await admin.post(`/api/people/${users[1].person.id}/movements`, {
            data: {
              expectedVersion: history.version,
              effectiveOn: "2026-09-08",
              reason: "Verificação da disponibilidade da equipe atual",
              changes: { supervisorRelationshipId },
            },
          })
        ).status(),
      ).toBe(201);
    };
    const before = await (await chief.get(url)).json();
    expect(
      before.members.some(
        (item: { personId: string }) => item.personId === users[1].person.id,
      ),
    ).toBe(true);
    await setChief(users[3].employment.id);
    restore = () => setChief(users[2].employment.id);
    const after = await (await chief.get(url)).json();
    expect(
      after.members.some(
        (item: { personId: string }) => item.personId === users[1].person.id,
      ),
    ).toBe(false);
    expect(after.absences).toEqual([]);
  } finally {
    if (restore) await restore();
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
