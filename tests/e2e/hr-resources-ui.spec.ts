import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture";
test.use({ actionTimeout: 15000 });
test("biblioteca permite publicar PDF, revisar sem perder campos e consultar histórico e ciência", async ({
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
  await page.goto("/biblioteca");
  await expect(
    page.getByRole("heading", { name: "Políticas e formulários", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publicar recurso", exact: true })
    .click();
  await expect(page.getByLabel("Título do recurso")).toBeFocused();
  await page.getByLabel("Título do recurso").fill("Política de demonstração");
  await page
    .getByLabel("Resumo", { exact: true })
    .fill("Orientações institucionais para uso dos serviços internos.");
  await page.getByLabel("Tipo", { exact: true }).selectOption("policy");
  await page.getByLabel("Categoria", { exact: true }).fill("Serviços internos");
  await page
    .getByLabel("Responsável", { exact: true })
    .fill("Gestão de Pessoas");
  await page.getByLabel("Início da vigência").fill("2026-01-01");
  await page.getByLabel("Fim da vigência").fill("2040-12-31");
  await page.getByLabel("Arquivo PDF").setInputFiles({
    name: "politica.pdf",
    mimeType: "application/pdf",
    buffer: blankPdf,
  });
  await page.getByLabel("Solicitar confirmação de ciência").check();
  await page.getByLabel("Confirmo a publicação desta versão.").check();
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
      path: `.impeccable/review/resources-form-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Confirmar publicação", exact: true })
    .click();
  await expect(
    page.getByText("Recurso publicado.", { exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar PDF", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toContain("-v1.pdf");
  await page.getByRole("button", { name: "Nova versão", exact: true }).click();
  await page
    .getByLabel("Título do recurso")
    .fill("Política de demonstração revisada");
  await page.getByLabel("Endereço HTTPS", { exact: true }).check();
  await page.getByLabel("URL do recurso").fill("https://www.cge.am.gov.br/");
  await page.getByLabel("Confirmo a publicação desta versão.").check();
  await page.route("**/api/hr-resources/*/versions", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        json: { message: "Publicação temporariamente indisponível." },
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Confirmar publicação", exact: true })
    .click();
  await expect(
    page.getByText("Publicação temporariamente indisponível."),
  ).toBeVisible();
  await expect(page.getByLabel("Título do recurso")).toHaveValue(
    "Política de demonstração revisada",
  );
  await page.unroute("**/api/hr-resources/*/versions");
  await page
    .getByRole("button", { name: "Confirmar publicação", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Nova versão publicada.", { exact: true }),
  ).toBeVisible();
  const currentId = new URL(page.url()).searchParams.get("id");
  await page
    .getByRole("button", { name: "Ver histórico", exact: true })
    .click();
  await expect(
    page.getByRole("link", {
      name: "Versão 1 — Política de demonstração",
      exact: true,
    }),
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
      path: `.impeccable/review/resources-history-${width}.png`,
      fullPage: true,
    });
  }
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
  await page.goto("/biblioteca");
  await page.getByLabel("Buscar na biblioteca").fill("demonstração");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page
    .getByRole("link", {
      name: "Política de demonstração revisada",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("link", { name: "Abrir link externo", exact: true }),
  ).toHaveAttribute("href", "https://www.cge.am.gov.br/");
  await expect(
    page.getByRole("button", { name: "Nova versão", exact: true }),
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
      path: `.impeccable/review/resources-read-${width}.png`,
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
  await page.request.post("/api/auth/logout");
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  await page.goto(`/biblioteca?id=${currentId}&manage=true`);
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar arquivamento", exact: true })
    .click();
  await expect(
    page.getByText("Recurso arquivado.", { exact: true }),
  ).toBeVisible();
});
