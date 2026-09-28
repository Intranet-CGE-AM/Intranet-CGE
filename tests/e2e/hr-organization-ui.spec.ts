import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("RH consulta a estrutura e mantém cargos com associação simples, confirmação e recuperação", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: {
          email: "admin-e2e@local.invalid",
          password: "Admin-E2E-Password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const unitResponse = await page.request.post("/api/organization-units", {
    data: {
      code: `ORG-UI-${Date.now()}`,
      name: "Unidade de demonstração de cargos",
    },
  });
  expect(unitResponse.status()).toBe(201);
  const unit = await unitResponse.json();
  const options = await (
    await page.request.get("/api/employment-options")
  ).json();
  expect(
    (
      await page.request.post("/api/people", {
        data: {
          fullName: "Pessoa de demonstração do quadro",
          employment: {
            employeeNumber: `ORG-UI-${Date.now()}`,
            unitId: unit.id,
            categoryId: options.categories[0].id,
            startDate: "2020-01-01",
            jobTitle: "Cargo informado no cadastro",
          },
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/rh/estrutura");
  await expect(
    page.getByRole("heading", { name: "Estrutura e cargos", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Unidade consultada").selectOption(unit.id);
  await page.getByRole("button", { name: "Tabela", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Estrutura por unidade" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Árvore", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Hierarquia de unidades" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Novo cargo", exact: true }).click();
  await page.getByLabel("Código do cargo").fill("ORG-UI");
  await page.getByLabel("Nome do cargo").fill("Analista institucional");
  await page.getByLabel("Quantidade prevista").fill("2");
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
      path: `.impeccable/review/organization-form-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Salvar cargo", exact: true }).click();
  await expect(page.getByText("Cargo salvo.", { exact: true })).toBeVisible();
  const person = page
    .getByRole("row")
    .filter({ hasText: "Pessoa de demonstração do quadro" });
  await person
    .getByLabel("Cargo do quadro")
    .selectOption({ label: "ORG-UI — Analista institucional" });
  await person.getByRole("button", { name: "Salvar associação" }).click();
  await expect(
    page.getByText("Associação salva.", { exact: true }),
  ).toBeVisible();
  await expect(person).toContainText("Cargo informado no cadastro");
  const position = page.getByRole("row").filter({
    has: page.getByRole("cell", {
      name: "Analista institucional",
      exact: true,
    }),
  });
  await expect(position).toContainText("1");
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
      path: `.impeccable/review/organization-list-${width}.png`,
      fullPage: true,
    });
  }
  await position.getByRole("button", { name: "Editar cargo" }).click();
  await page.getByLabel("Quantidade prevista").fill("0");
  await expect(
    page.getByText(/1 vínculo ficará acima da quantidade prevista/),
  ).toBeVisible();
  await page.getByLabel("Confirmo a redução sem excluir vínculos").check();
  await page.route(
    "**/api/organization/positions/*",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Serviço temporariamente indisponível.",
        }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Salvar cargo", exact: true }).click();
  await expect(
    page.getByText("Serviço temporariamente indisponível."),
  ).toBeVisible();
  await expect(page.getByLabel("Quantidade prevista")).toHaveValue("0");
  await expect(page.getByLabel("Unidade consultada")).toBeDisabled();
  await page.getByRole("button", { name: "Salvar cargo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Quantidade prevista")).toBeHidden();
  await expect(position).toContainText("1 acima do previsto");
  await person.getByLabel("Cargo do quadro").selectOption("");
  await person.getByRole("button", { name: "Salvar associação" }).click();
  await expect(
    person.getByRole("button", { name: "Salvar associação" }),
  ).toBeDisabled();
  await position.getByRole("button", { name: "Editar cargo" }).click();
  await page.getByLabel("Cargo ativo").uncheck();
  await page.getByRole("button", { name: "Salvar cargo", exact: true }).click();
  await expect(position).toContainText("Inativo");
  await page.getByRole("button", { name: "Alterar unidade superior" }).click();
  await page
    .getByLabel("Unidade superior")
    .selectOption({ label: "Tecnologia da Informação" });
  await page.getByRole("button", { name: "Salvar hierarquia" }).click();
  await expect(
    page.getByText("Hierarquia salva.", { exact: true }),
  ).toBeVisible();
});
