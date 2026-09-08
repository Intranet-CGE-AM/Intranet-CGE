import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";

test("correções respeitam rejeição, escopo de transferência e concorrência", async ({
  playwright,
}) => {
  const options = {
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
  };
  const admin = await playwright.request.newContext(options);
  const worker = await playwright.request.newContext(options);
  const rh = await playwright.request.newContext(options);
  const overrides: string[] = [];
  try {
    await admin.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const { user } = await (
      await worker.post("/api/auth/login", {
        data: {
          email: "dandara.ribeiro@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    const { user: manager } = await (
      await rh.post("/api/auth/login", {
        data: {
          email: "leonardo.araujo@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    const grant = async (
      accountId: string,
      permission: string,
      unitId: string,
    ) => {
      const response = await admin.post("/api/admin/permission-overrides", {
        data: { accountId, permission, effect: "allow", unitId },
      });
      expect(response.status()).toBe(201);
      overrides.push((await response.json()).id);
    };
    await grant(user.account.id, "hr_requests.create", user.employment.unit.id);
    await grant(
      manager.account.id,
      "hr_requests.manage",
      user.employment.unit.id,
    );
    const before = await (await worker.get("/api/me/dossier")).json();
    const submit = async (correction: object) => {
      const response = await worker.post("/api/hr-requests", {
        data: {
          type: "correction",
          description: "Solicito revisão dos dados cadastrais.",
          correction,
        },
      });
      expect(response.status()).toBe(201);
      return response.json();
    };
    const rejected = await submit({
      fullName: before.fullName,
      preferredName: "Nome rejeitado",
    });
    expect(rejected.correction.proposed).toEqual({
      preferredName: "Nome rejeitado",
    });
    await rh.post(`/api/hr-requests/${rejected.id}/transition`, {
      data: { action: "start", version: 1 },
    });
    expect(
      (
        await rh.post(`/api/hr-requests/${rejected.id}/transition`, {
          data: {
            action: "reject",
            version: 2,
            message: "Proposta não confirmada pelo RH.",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await worker.get("/api/me/dossier")).json()).preferredName,
    ).toBe(before.preferredName);
    const { units } = await (await admin.get("/api/organization-units")).json();
    const destination = units.find(
      (unit: { id: string }) => unit.id !== user.employment.unit.id,
    );
    const transfer = await submit({ employment: { unitId: destination.id } });
    await rh.post(`/api/hr-requests/${transfer.id}/transition`, {
      data: { action: "start", version: 1 },
    });
    const decision = {
      action: "complete",
      version: 2,
      message: "Transferência conferida e aprovada.",
    };
    expect(
      (
        await rh.post(`/api/hr-requests/${transfer.id}/transition`, {
          data: decision,
        })
      ).status(),
    ).toBe(403);
    await grant(manager.account.id, "people.manage", user.employment.unit.id);
    expect(
      (
        await rh.post(`/api/hr-requests/${transfer.id}/transition`, {
          data: decision,
        })
      ).status(),
    ).toBe(403);
    expect(
      (await (await worker.get("/api/me/dossier")).json()).employment.unitId,
    ).toBe(user.employment.unit.id);
    await grant(manager.account.id, "people.manage", destination.id);
    const outcomes = await Promise.all(
      [1, 2].map(() =>
        rh.post(`/api/hr-requests/${transfer.id}/transition`, {
          data: decision,
        }),
      ),
    );
    expect(outcomes.map((result) => result.status()).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (await (await worker.get("/api/me/dossier")).json()).employment.unitId,
    ).toBe(destination.id);
    const history = await (
      await worker.get("/api/me/employment-history")
    ).json();
    expect(
      history.movements.filter(
        (item: { type: string; next: string }) =>
          item.type === "unitId" && item.next === destination.id,
      ),
    ).toHaveLength(1);
  } finally {
    for (const id of overrides)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await admin.dispose();
    await worker.dispose();
    await rh.dispose();
  }
});
