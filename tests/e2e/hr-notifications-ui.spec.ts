import AxeBuilder from "@axe-core/playwright";
import { clientHeaders, expect, test } from "./fixtures";

test.use({ actionTimeout: 15000 });
test("notificações mostram resumo, atualizam sino sem recarga e recuperam falha sem perder leitura", async ({
  page,
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
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
    await page.request.post("/api/notifications/read-all");
    const templateResponse = await admin.post("/api/onboarding-templates", {
      data: {
        name: "Checklist para testar avisos",
        kind: "entry",
        active: true,
        items: [
          {
            title: "Conferir integração",
            area: "Servidor",
            required: true,
            active: true,
          },
        ],
      },
    });
    expect(templateResponse.status()).toBe(201);
    const template = await templateResponse.json();
    for (let index = 0; index < 2; index++)
      expect(
        (
          await admin.post("/api/checklists", {
            data: {
              personId: user.person.id,
              employmentId: user.employment.id,
              templateId: template.id,
              assignments: [{ itemIndex: 0, accountId: user.account.id }],
            },
          })
        ).status(),
      ).toBe(201);
    await page.goto("/notificacoes");
    await expect(
      page.getByRole("link", {
        name: "Notificações, 2 não lidas",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Consulte suas responsabilidades na intranet.").first(),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.impeccable/review/notifications-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Marcar como lida", exact: true })
      .first()
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("link", {
        name: "Notificações, 1 não lidas",
        exact: true,
      }),
    ).toBeVisible();
    await page.route("**/api/notifications?page=*", (route) =>
      route.fulfill({
        status: 503,
        json: { message: "Consulta indisponível" },
      }),
    );
    await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
    await expect(
      page.getByText(
        "Não foi possível carregar as notificações. Tente novamente.",
      ),
    ).toBeVisible();
    expect(
      (await (await page.request.get("/api/notifications")).json()).unreadCount,
    ).toBe(0);
    await page.unroute("**/api/notifications?page=*");
    await page
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Marcar como lida", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: "Notificações, 0 não lidas",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Marcar todas como lidas" }),
    ).toBeDisabled();
    await page.goto("/conta");
    await page
      .getByRole("link", { name: "Histórico de notificações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Notificações", exact: true }),
    ).toBeVisible();
  } finally {
    await admin.dispose();
  }
});
