import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";

test.use({ actionTimeout: 15_000 });
test("pedido de complemento notifica o titular sem expor o conteúdo", async ({
  page,
  playwright,
}) => {
  const headers = { Origin: "http://127.0.0.1:4173" };
  const admin = await playwright.request.newContext({
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
    const login = await page.request.post("/api/auth/login", {
      headers,
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
    const created = await page.request.post("/api/hr-requests", {
      headers,
      data: {
        type: "other",
        description: "Gostaria de atualizar uma informação do meu vínculo.",
      },
    });
    expect(created.status()).toBe(201);
    const item = await created.json();
    expect(
      (
        await admin.post(`/api/hr-requests/${item.id}/transition`, {
          data: { version: 1, action: "start" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post(`/api/hr-requests/${item.id}/transition`, {
          data: {
            version: 2,
            action: "request_information",
            message: "Informe o número de referência do processo.",
            deadline: "2029-05-01",
          },
        })
      ).status(),
    ).toBe(200);
    const notifications = await (
      await page.request.get("/api/notifications")
    ).json();
    expect(notifications.unreadCount).toBe(2);
    expect(JSON.stringify(notifications)).not.toContain("número de referência");
    await page.goto("/notificacoes");
    await page.getByRole("link", { name: "RH solicitou informações" }).click();
    await expect(
      page
        .getByText("Informe o número de referência do processo.", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await page
      .getByLabel("Informações complementares")
      .fill("Referência interna: processo 12345.");
    await page.getByRole("button", { name: "Enviar complemento" }).click();
    await expect(page.getByText("Solicitação atualizada.")).toBeVisible();
    const detail = await (
      await page.request.get(`/api/hr-requests/${item.id}`)
    ).json();
    expect(detail).toMatchObject({
      version: 4,
      informationDeadline: null,
      informationMessage: null,
    });
    expect(detail.events.at(-1)).toMatchObject({
      type: "provide_information",
      message: "Referência interna: processo 12345.",
    });
    const notificationId = notifications.notifications[0].id;
    expect(
      (await admin.post(`/api/notifications/${notificationId}/read`)).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/notifications/read-all", { headers })
      ).status(),
    ).toBe(204);
    expect(
      (await (await page.request.get("/api/notifications")).json()).unreadCount,
    ).toBe(0);
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await admin.dispose();
  }
});
