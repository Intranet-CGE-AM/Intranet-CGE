import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test("RH consulta indicadores por período e recupera falha sem mostrar totais antigos", async ({
  page,
}) => {
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  await page.goto("/rh/indicadores");
  await expect(
    page.getByRole("heading", {
      name: "Indicadores de Gestão de Pessoas",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Solicitações por tipo e situação",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "A média considera solicitações concluídas no período, desde o envio até a conclusão.",
      { exact: true },
    ),
  ).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `.impeccable/review/metrics-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByLabel("Unidade")
    .selectOption({ label: "Tecnologia da Informação" });
  await page.getByRole("button", { name: "Consultar indicadores" }).click();
  await expect(
    page.getByText("Unidade consultada: Tecnologia da Informação", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Unidade").selectOption({ label: "Controle Interno" });
  await expect(
    page.getByText("Unidade consultada: Tecnologia da Informação", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Data inicial").fill("2001-01-01");
  await page.getByLabel("Data final").fill("2001-01-01");
  await page.route(
    "**/api/hr-metrics?*",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Indicadores temporariamente indisponíveis.",
        }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Consultar indicadores" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Indicadores temporariamente indisponíveis.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Solicitações por tipo e situação",
      exact: true,
    }),
  ).toBeHidden();
  await expect(page.getByLabel("Data inicial")).toHaveValue("2001-01-01");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByText("Período consultado: 01/01/2001 a 01/01/2001", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhuma solicitação concluída no período.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("período inválido pede correção dos campos, sem repetir consulta anterior", async ({
  page,
}) => {
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  await page.goto("/rh/indicadores");
  const consult = page.getByRole("button", { name: "Consultar indicadores" });
  await expect(consult).toBeEnabled();
  await page.getByLabel("Data inicial").fill("2024-01-01");
  await page.getByLabel("Data final").fill("2026-01-01");
  await consult.click();
  await expect(
    page.getByText("Informe um período válido de até 366 dias.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeHidden();
  await expect(page.getByLabel("Data inicial")).toHaveValue("2024-01-01");
});
