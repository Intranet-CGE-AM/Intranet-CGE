import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";

test("correção só altera o cadastro após aprovação e não aplica duas vezes", async ({
  playwright,
}) => {
  const headers = { Origin: "http://127.0.0.1:4173" };
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), ...headers },
  });
  const worker = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), ...headers },
  });
  let overrideId: string | undefined;
  try {
    await admin.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const login = await worker.post("/api/auth/login", {
      data: {
        email: "dandara.ribeiro@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    const { user } = await login.json();
    const override = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: user.account.id,
        permission: "hr_requests.create",
        effect: "allow",
        unitId: user.employment.unit.id,
      },
    });
    expect(override.status()).toBe(201);
    overrideId = (await override.json()).id;
    const before = await (await worker.get("/api/me/dossier")).json();
    const submitted = await worker.post("/api/hr-requests", {
      data: {
        type: "correction",
        description: "Solicito correção do meu nome preferido.",
        correction: { preferredName: "Dandara E2E" },
      },
    });
    expect(submitted.status()).toBe(201);
    const request = await submitted.json();
    expect(request.correction).toMatchObject({
      previous: { preferredName: before.preferredName },
      proposed: { preferredName: "Dandara E2E" },
    });
    expect(
      (await (await worker.get("/api/me/employment-history")).json())
        .provenance,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "preferredName", state: "pending" }),
      ]),
    );
    expect(
      (await (await worker.get("/api/me/dossier")).json()).preferredName,
    ).toBe(before.preferredName);
    expect(
      (
        await admin.post(`/api/hr-requests/${request.id}/transition`, {
          data: { action: "start", version: 1 },
        })
      ).status(),
    ).toBe(200);
    const decision = {
      action: "complete",
      version: 2,
      message: "Dados conferidos e correção aprovada.",
    };
    expect(
      (
        await admin.post(`/api/hr-requests/${request.id}/transition`, {
          data: decision,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post(`/api/hr-requests/${request.id}/transition`, {
          data: decision,
        })
      ).status(),
    ).toBe(409);
    expect(
      (await (await worker.get("/api/me/dossier")).json()).preferredName,
    ).toBe("Dandara E2E");
    const history = await (
      await worker.get("/api/me/employment-history")
    ).json();
    const notices = (
      await (await worker.get("/api/notifications")).json()
    ).notifications.filter((item: { href: string }) =>
      item.href.includes(request.id),
    );
    expect(notices).toHaveLength(2);
    expect(
      notices.every(
        (item: { message: string }) =>
          item.message === "Consulte o andamento na intranet.",
      ),
    ).toBe(true);
    expect(JSON.stringify(notices)).not.toContain("Dandara E2E");
    expect(history.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "preferredName",
          source: "manual",
          value: "Dandara E2E",
        }),
      ]),
    );
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await admin.dispose();
    await worker.dispose();
  }
});
