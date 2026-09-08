import { clientHeaders, expect, test } from "./fixtures";

test("hierarquia impede ciclos e restringe estrutura, totais e gestão às unidades autorizadas", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, scoped] = clients;
  const grants: string[] = [];
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "leonardo.araujo@homolog.cge.am.gov.br",
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
    const units = [];
    for (const name of ["Origem", "Destino"]) {
      const response = await admin.post("/api/organization-units", {
        data: {
          code: `TREE-${name}-${Date.now()}`,
          name: `Unidade ${name} da hierarquia`,
        },
      });
      expect(response.status()).toBe(201);
      units.push(await response.json());
    }
    const [a, b] = units;
    const parent = (id: string) => `/api/organization/units/${id}/parent`;
    expect(
      (
        await admin.put(parent(a.id), {
          data: { parentId: b.id, expectedParentId: null },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.put(parent(b.id), {
          data: { parentId: a.id, expectedParentId: null },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.put(parent(a.id), {
          data: { parentId: a.id, expectedParentId: b.id },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.put(parent(a.id), {
          data: { parentId: null, expectedParentId: null },
        })
      ).status(),
    ).toBe(409);
    expect((await scoped.get("/api/organization")).status()).toBe(403);
    async function grant(permission: string) {
      const response = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[1].account.id,
          permission,
          effect: "allow",
          unitId: a.id,
        },
      });
      expect(response.status()).toBe(201);
      grants.push((await response.json()).id);
    }
    await grant("organization.read");
    const view = await (await scoped.get("/api/organization")).json();
    expect(view.units).toEqual([
      expect.objectContaining({
        id: a.id,
        parentId: null,
        parentOutsideScope: true,
        peopleCount: 0,
        positions: [],
        employments: [],
        canManage: false,
      }),
    ]);
    expect(JSON.stringify(view)).not.toContain(b.id);
    const input = {
      unitId: a.id,
      code: "SCOPED",
      title: "Cargo restrito",
      plannedCount: 1,
      active: true,
    };
    expect(
      (
        await scoped.post("/api/organization/positions", { data: input })
      ).status(),
    ).toBe(403);
    await grant("organization.manage_positions");
    expect(
      (
        await scoped.post("/api/organization/positions", { data: input })
      ).status(),
    ).toBe(201);
    expect(
      (
        await scoped.post("/api/organization/positions", {
          data: { ...input, unitId: b.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await scoped.put(parent(b.id), {
          data: { parentId: null, expectedParentId: null },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await scoped.put(parent(a.id), {
          data: { parentId: b.id, expectedParentId: b.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await scoped.post(
          `/api/organization/employments/${users[1].employment.id}/position`,
          { data: { positionId: null, version: 1 } },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await scoped.put(parent(a.id), {
          data: { parentId: null, expectedParentId: b.id },
        })
      ).status(),
    ).toBe(200);
    const concurrent = await Promise.all([
      admin.put(parent(a.id), {
        data: { parentId: b.id, expectedParentId: null },
      }),
      admin.put(parent(b.id), {
        data: { parentId: a.id, expectedParentId: null },
      }),
    ]);
    expect(concurrent.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    const audit = await (
      await admin.get("/api/audit-events?action=organization.parent-changed")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectId: a.id })]),
    );
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
