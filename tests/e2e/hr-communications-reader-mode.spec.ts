import { clientHeaders, expect, test } from "./fixtures";
test.use({ actionTimeout: 15000 });
test("gestor mantém modo de leitura na URL e consegue confirmar ciência após recarregar", async ({
  page,
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  let grantId = "";
  try {
    expect(
      (
        await admin.post("/api/auth/login", {
          data: {
            email: "admin-e2e@local.invalid",
            password: "Admin-E2E-Password-123",
          },
        })
      ).status(),
    ).toBe(200);
    const login = await page.request.post("/api/auth/login", {
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    expect(login.status()).toBe(200);
    const { user } = await login.json();
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: user.account.id,
        permission: "hr_communications.manage",
        effect: "allow",
        unitId: null,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    const created = await admin.post("/api/hr-communications", {
      data: {
        title: "Leitura também disponível para gestores",
        summary:
          "Gestores confirmam ciência como qualquer integrante do público.",
        body: "Leia **esta orientação** e confirme sua ciência.",
        publicationAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2040-12-31T23:59:59.000Z",
        audience: { type: "all" },
        requiresAcknowledgment: true,
      },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    expect(
      (
        await admin.post(`/api/hr-communications/${id}/publish`, {
          data: { version: 1 },
        })
      ).status(),
    ).toBe(200);
    await page.goto(`/comunicados?id=${id}`);
    await expect(
      page.getByRole("button", { name: "Confirmar ciência", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Editar", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Confirmar ciência", exact: true }),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.impeccable/review/communications-manager-reader-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Confirmar ciência", exact: true })
      .click();
    await expect(page.getByText(/Ciência confirmada em/)).toBeVisible();
    await page.getByRole("button", { name: "Voltar à lista" }).click();
    await expect(
      page.getByRole("button", { name: "Para meu público" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Para meu público" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Gerenciar comunicados" }).click();
    await page
      .getByRole("link", {
        name: "Leitura também disponível para gestores",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Editar", exact: true }),
    ).toBeVisible();
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await admin.dispose();
  }
});
