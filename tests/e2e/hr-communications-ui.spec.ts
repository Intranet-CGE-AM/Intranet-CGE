import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test.use({ actionTimeout: 15000 });
test("RH publica comunicado simples e colaborador lê no início e confirma ciência por teclado", async ({
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
  await page.goto("/comunicados");
  await expect(
    page.getByRole("heading", { name: "Comunicados", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Novo comunicado" }).click();
  await expect(page.getByLabel("Título", { exact: true })).toBeFocused();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Atualização cadastral — demonstração");
  await page
    .getByLabel("Resumo", { exact: true })
    .fill(
      "Confira seus dados na intranet e solicite correção quando necessário.",
    );
  await page
    .getByLabel("Conteúdo em Markdown")
    .fill(
      "## Confira seus dados\n\nAcesse **Meu dossiê** e confira as informações.\n\n- Verifique sua unidade\n- Solicite correção quando necessário\n\n<script>window.comunicadoInseguro = true</script>",
    );
  await page
    .getByLabel("Publicação (horário de Manaus)")
    .fill("2026-01-01T08:00");
  await page
    .getByLabel("Expiração (horário de Manaus)")
    .fill("2040-12-31T18:00");
  await page.getByLabel("Público", { exact: true }).selectOption("units");
  await page
    .getByRole("checkbox", { name: "Tecnologia da Informação", exact: true })
    .check();
  await page.getByLabel("Solicitar confirmação de ciência").check();
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
      path: `.impeccable/review/communications-form-${width}.png`,
      fullPage: true,
    });
  }
  await page.route("**/api/hr-communications", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        json: { message: "Publicação temporariamente indisponível." },
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(
    page.getByText("Publicação temporariamente indisponível."),
  ).toBeVisible();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "Atualização cadastral — demonstração",
  );
  await page.unroute("**/api/hr-communications");
  await page.getByRole("button", { name: "Salvar rascunho" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Rascunho salvo.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar publicação", exact: true })
    .click();
  await expect(
    page.getByText("Comunicado publicado.", { exact: true }),
  ).toBeVisible();
  await page.request.post("/api/auth/logout");
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: {
          email: "caio.nascimento@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/");
  await page
    .getByRole("link", {
      name: "Atualização cadastral — demonstração",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confira seus dados", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => "comunicadoInseguro" in window)).toBe(false);
  await expect(
    page.getByRole("button", { name: "Novo comunicado" }),
  ).toHaveCount(0);
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
      path: `.impeccable/review/communications-read-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Confirmar ciência", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Ciência confirmada em/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Ciência confirmada em/)).toBeVisible();
  await page.goto("/rh");
  await expect(
    page.getByRole("link", {
      name: "Atualização cadastral — demonstração",
      exact: true,
    }),
  ).toBeVisible();
});
