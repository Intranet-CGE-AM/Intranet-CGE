import { clientHeaders, expect, test } from "./fixtures";

test("ocorrência congela chefia no envio e separa escopo do RH de leitura privada", async ({
  playwright,
}) => {
  const emails = [
    "admin-e2e@local.invalid",
    ...[
      "caio.nascimento",
      "helena.monteiro",
      "leonardo.araujo",
      "marina.rocha",
    ].map((name) => `${name}@homolog.cge.am.gov.br`),
  ];
  const contexts = await Promise.all(
    emails.map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, chief, replacement, hr] = contexts;
  const grants: string[] = [];
  let restore: (() => Promise<void>) | undefined;
  try {
    const users = [];
    for (const [index, email] of emails.entries()) {
      const login = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password:
            index === 0 ? "Admin-E2E-Password-123" : "Homolog-Password-2026",
        },
      });
      expect(login.status()).toBe(200);
      users.push((await login.json()).user);
    }
    const unitId = users[1].employment.unit.id;
    const grant = async (
      index: number,
      permission: string,
      targetUnit = unitId,
    ) => {
      const response = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[index].account.id,
          permission,
          effect: "allow",
          unitId: targetUnit,
        },
      });
      expect(response.status()).toBe(201);
      grants.push((await response.json()).id);
    };
    await grant(1, "occurrences.create");
    await grant(2, "occurrences.review.supervisor");
    await grant(3, "occurrences.review.supervisor");
    await grant(4, "occurrences.review.final", users[4].employment.unit.id);
    const historyUrl = `/api/people/${users[1].person.id}/employment-history`;
    const original = await (await admin.get(historyUrl)).json();
    const originalChief = original.employments.find(
      (item: { id: string }) => item.id === users[1].employment.id,
    ).supervisorRelationshipId;
    const setChief = async (supervisorRelationshipId: string) => {
      const history = await (await admin.get(historyUrl)).json();
      const response = await admin.post(
        `/api/people/${users[1].person.id}/movements`,
        {
          data: {
            expectedVersion: history.version,
            effectiveOn: "2026-09-08",
            reason: "Verificação da chefia responsável no envio",
            changes: { supervisorRelationshipId },
          },
        },
      );
      expect(response.status()).toBe(201);
    };
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Verificação de escopo e chefia",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: false,
        affectsAvailability: true,
        documentTypeId: null,
      },
    });
    expect(type.status()).toBe(201);
    const created = await worker.post("/api/occurrences", {
      data: {
        typeId: (await type.json()).id,
        startDate: "2035-08-04",
        endDate: "2035-08-05",
        justification:
          "Justificativa privada para equipe expressamente autorizada",
        submit: false,
      },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const url = `/api/occurrences/${id}`;
    await setChief(users[3].employment.id);
    restore = () => setChief(originalChief);
    expect(
      (
        await worker.post(`${url}/transition`, {
          data: { action: "submit", version: 1 },
        })
      ).status(),
    ).toBe(200);
    await restore();
    restore = undefined;
    expect((await chief.get(url)).status()).toBe(404);
    expect(
      (
        await chief.post(`${url}/transition`, {
          data: { action: "approve", version: 2 },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await replacement.post(`${url}/transition`, {
          data: { action: "approve", version: 2 },
        })
      ).status(),
    ).toBe(200);
    expect((await hr.get(url)).status()).toBe(404);
    expect(
      (
        await hr.post(`${url}/transition`, {
          data: { action: "approve", version: 3 },
        })
      ).status(),
    ).toBe(403);
    await grant(4, "occurrences.review.final");
    const administrative = await (await hr.get(url)).json();
    expect(administrative).not.toHaveProperty("justification");
    await grant(4, "documents.sensitive.read");
    const privateView = await (await hr.get(url)).json();
    expect(privateView.justification).toContain("Justificativa privada");
    const audit = await (
      await admin.get("/api/audit-events?action=occurrence.private-read")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: expect.objectContaining({ accountId: users[4].account.id }),
          objectId: id,
        }),
      ]),
    );
    expect(JSON.stringify(audit)).not.toContain("Justificativa privada");
    expect(
      (
        await hr.post(`${url}/transition`, {
          data: { action: "approve", version: 3 },
        })
      ).status(),
    ).toBe(200);
  } finally {
    if (restore) await restore();
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
