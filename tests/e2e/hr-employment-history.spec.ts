import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";

test.use({ actionTimeout: 15_000 });
test("mudança de vínculo mantém antes/depois e recusa versão desatualizada", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
  });
  try {
    expect((await api.get("/api/me/employment-history")).status()).toBe(401);
    await api.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const units = (await (await api.get("/api/organization-units")).json())
      .units;
    const categories = (
      await (await api.get("/api/employment-categories")).json()
    ).categories;
    const created = await api.post("/api/people", {
      data: {
        fullName: "Histórico Funcional E2E",
        employment: {
          employeeNumber: `HIST-${Date.now()}`,
          unitId: units[0].id,
          categoryId: categories[0].id,
          startDate: "2020-01-01",
          jobTitle: "Analista",
        },
      },
    });
    expect(created.status()).toBe(201);
    const { personId } = await created.json();
    const initial = await api.get(`/api/people/${personId}/employment-history`);
    expect(initial.status()).toBe(200);
    const history = await initial.json();
    expect(history.movements).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "admission" })]),
    );
    const body = {
      expectedVersion: history.version,
      effectiveOn: "2026-09-07",
      reason: "Designação administrativa de teste",
      changes: { jobTitle: "Analista sênior" },
    };
    const moved = await api.post(`/api/people/${personId}/movements`, {
      data: body,
    });
    expect(moved.status()).toBe(201);
    expect(
      (
        await api.post(`/api/people/${personId}/movements`, { data: body })
      ).status(),
    ).toBe(409);
    const updated = await (
      await api.get(`/api/people/${personId}/employment-history`)
    ).json();
    expect(updated.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "jobTitle",
          previous: "Analista",
          next: "Analista sênior",
          reason: body.reason,
        }),
      ]),
    );
    expect(
      (
        await api.post(`/api/people/${personId}/movements`, {
          data: {
            ...body,
            expectedVersion: updated.version,
            effectiveOn: "2019-01-01",
          },
        })
      ).status(),
    ).toBe(400);
    const invalid = await api.post(`/api/people/${personId}/movements`, {
      data: {
        ...body,
        expectedVersion: updated.version,
        changes: {
          unitId: "00000000-0000-4000-8000-000000000099",
          jobTitle: "Não deve persistir",
        },
      },
    });
    expect(invalid.status()).toBe(500);
    const unchanged = await (
      await api.get(`/api/people/${personId}/employment-history`)
    ).json();
    expect(unchanged.version).toBe(updated.version);
    expect(unchanged.movements).toHaveLength(updated.movements.length);
    expect(unchanged.employments[0].jobTitle).toBe("Analista sênior");
    const rh = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:4173",
      extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
    });
    try {
      const logged = await rh.post("/api/auth/login", {
        data: {
          email: "marina.rocha@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      });
      const { user } = await logged.json();
      expect(
        (await rh.get(`/api/people/${personId}/employment-history`)).status(),
      ).toBe(404);
      expect(
        (
          await api.post("/api/admin/permission-overrides", {
            data: {
              accountId: user.account.id,
              permission: "employment.manage_history",
              effect: "allow",
              unitId: units[0].id,
            },
          })
        ).status(),
      ).toBe(201);
      expect(
        (await rh.get(`/api/people/${personId}/employment-history`)).status(),
      ).toBe(200);
      const destination = await (
        await api.post("/api/organization-units", {
          data: { code: `MOVE-${Date.now()}`, name: "Destino restrito E2E" },
        })
      ).json();
      expect(
        (
          await rh.post(`/api/people/${personId}/movements`, {
            data: {
              ...body,
              expectedVersion: updated.version,
              changes: { unitId: destination.id },
            },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await rh.dispose();
    }
    const email = `historico-${Date.now()}@local.invalid`;
    const password = "Historico-E2E-Password-123";
    expect(
      (
        await api.post("/api/admin/users", {
          data: { personId, email, temporaryPassword: password },
        })
      ).status(),
    ).toBe(201);
    const employee = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:4173",
      extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
    });
    try {
      expect(
        (
          await employee.post("/api/auth/login", { data: { email, password } })
        ).status(),
      ).toBe(200);
      expect(
        (
          await api.post(`/api/people/${personId}/deactivate`, {
            data: { endDate: "2026-09-07" },
          })
        ).status(),
      ).toBe(200);
      expect((await employee.get("/api/auth/me")).status()).toBe(401);
      const closed = await (
        await api.get(`/api/people/${personId}/employment-history`)
      ).json();
      expect(closed.movements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "endDate", next: "2026-09-07" }),
        ]),
      );
    } finally {
      await employee.dispose();
    }
  } finally {
    await api.dispose();
  }
});
