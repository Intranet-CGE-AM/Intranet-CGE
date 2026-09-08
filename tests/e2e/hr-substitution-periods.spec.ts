import { clientHeaders, expect, test } from "./fixtures";

test("período e edição versionada controlam a substituição, respeitando negativas e autoridade original", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1, 2, 3].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, chief, substitute, worker] = clients;
  let substitutionId = "";
  let version = 1;
  let overrideId = "";
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "helena.monteiro@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
      "caio.nascimento@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await clients[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    const payload = {
      originalAccountId: users[1].account.id,
      substituteAccountId: users[2].account.id,
      unitId: users[3].employment.unit.id,
      startsOn: "2026-01-01",
      endsOn: "2040-12-31",
      reason: "Continuidade da chefia durante afastamento.",
      flows: ["vacations.review.supervisor"],
    };
    const vacation = await worker.post("/api/vacation-requests", {
      data: { startDate: "2043-06-01", endDate: "2043-06-05", submit: true },
    });
    expect(vacation.status()).toBe(201);
    const record = await vacation.json();
    const created = await admin.post("/api/substitutions", { data: payload });
    expect(created.status()).toBe(201);
    substitutionId = (await created.json()).id;
    const item = expect.arrayContaining([
      expect.objectContaining({ id: `vacation:${record.id}` }),
    ]);
    const denial = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: users[2].account.id,
        permission: "vacations.review.supervisor",
        effect: "deny",
        unitId: null,
      },
    });
    expect(denial.status()).toBe(201);
    overrideId = (await denial.json()).id;
    expect(
      (await (await substitute.get("/api/inbox")).json()).items,
    ).not.toEqual(item);
    expect((await (await chief.get("/api/inbox")).json()).items).toEqual(item);
    await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    overrideId = "";
    expect(
      (
        await admin.post("/api/substitutions", {
          data: {
            ...payload,
            originalAccountId: users[2].account.id,
            substituteAccountId: users[3].account.id,
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (await admin.post("/api/substitutions", { data: payload })).status(),
    ).toBe(409);
    expect(
      (
        await worker.put(`/api/substitutions/${substitutionId}`, {
          data: { ...payload, version },
        })
      ).status(),
    ).toBe(403);
    const future = { ...payload, startsOn: "2045-01-01", endsOn: "2045-12-31" };
    const updated = await admin.put(`/api/substitutions/${substitutionId}`, {
      data: { ...future, version },
    });
    expect(updated.status()).toBe(200);
    version++;
    expect(
      (await (await substitute.get("/api/inbox")).json()).items,
    ).not.toEqual(item);
    expect((await (await chief.get("/api/inbox")).json()).items).toEqual(item);
    expect(
      (
        await admin.put(`/api/substitutions/${substitutionId}`, {
          data: { ...payload, version: 1 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.put(`/api/substitutions/${substitutionId}`, {
          data: { ...payload, version },
        })
      ).status(),
    ).toBe(200);
    version++;
    expect((await (await substitute.get("/api/inbox")).json()).items).toEqual(
      item,
    );
    expect(
      (
        await admin.put(`/api/substitutions/${substitutionId}`, {
          data: {
            ...payload,
            startsOn: "2020-01-01",
            endsOn: "2020-12-31",
            version,
          },
        })
      ).status(),
    ).toBe(200);
    version++;
    expect(
      (await (await substitute.get("/api/inbox")).json()).items,
    ).not.toEqual(item);
    expect((await (await chief.get("/api/inbox")).json()).items).toEqual(item);
    const concurrent = await Promise.all(
      [payload, future].map((input) =>
        admin.put(`/api/substitutions/${substitutionId}`, {
          data: { ...input, version },
        }),
      ),
    );
    expect(concurrent.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    version++;
    const audit = await (
      await admin.get("/api/audit-events?action=substitution.updated")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: substitutionId,
          outcome: "success",
        }),
      ]),
    );
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    if (substitutionId)
      await admin.post(`/api/substitutions/${substitutionId}/cancel`, {
        data: { version },
      });
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
