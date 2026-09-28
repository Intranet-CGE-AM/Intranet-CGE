import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test.use({ actionTimeout: 15_000 });
test("RH registra novo cargo e consulta antes/depois no histórico", async ({
  page,
}) => {
  const headers = { Origin: "http://127.0.0.1:4173" };
  expect(
    (
      await page.request.post("/api/auth/login", {
        headers,
        data: {
          email: "admin-e2e@local.invalid",
          password: "Admin-E2E-Password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const { units } = await (
    await page.request.get("/api/organization-units")
  ).json();
  const { categories } = await (
    await page.request.get("/api/employment-categories")
  ).json();
  const created = await page.request.post("/api/people", {
    headers,
    data: {
      fullName: "Histórico da Interface E2E",
      employment: {
        employeeNumber: `HUI-${Date.now()}`,
        unitId: units[0].id,
        categoryId: categories[0].id,
        startDate: "2020-01-01",
        jobTitle: "Analista inicial",
      },
    },
  });
  expect(created.status()).toBe(201);
  const { personId } = await created.json();
  let optionsFail = true;
  await page.route("**/api/employment-options?*", async (route) => {
    if (optionsFail) {
      optionsFail = false;
      await route.fulfill({
        status: 500,
        json: { message: "Falha temporária nas opções" },
      });
    } else await route.continue();
  });
  await page.goto(`/rh/historico?personId=${personId}`);
  await expect(
    page.getByRole("heading", { name: "Histórico funcional", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tentar carregar opções" }).click();
  await page.getByLabel("Tipo de movimentação").selectOption("unitId");
  await expect(
    page.getByLabel("Nova unidade").locator("option"),
  ).not.toHaveCount(1);
  await page.getByLabel("Tipo de movimentação").selectOption("jobTitle");
  await page.getByLabel("Novo cargo").fill("Analista especializado");
  await page.getByLabel("Vigência").fill("2026-09-07");
  await page
    .getByLabel("Justificativa")
    .fill("Designação formal conferida pelo RH");
  let historyFail = true;
  await page.route(
    `**/api/people/${personId}/employment-history`,
    async (route) => {
      if (historyFail) {
        historyFail = false;
        await route.fulfill({
          status: 500,
          json: { message: "Falha temporária na leitura" },
        });
      } else await route.continue();
    },
  );
  await page
    .getByRole("button", { name: "Registrar movimentação", exact: true })
    .click();
  await expect(
    page.getByText("Registro salvo; não foi possível atualizar o histórico.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar movimentação", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByText("Histórico atualizado.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Analista inicial → Analista especializado", {
      exact: true,
    }),
  ).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.impeccable/review/history-${width}.png`,
      fullPage: true,
    });
  }
});
