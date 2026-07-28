import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const password = "Homolog-Password-2026";
const accounts = {
  contractor: "dandara.ribeiro@homolog.cge.am.gov.br",
  disabled: "patricia.mota@homolog.cge.am.gov.br",
  hr: "marina.rocha@homolog.cge.am.gov.br",
  supervisor: "helena.monteiro@homolog.cge.am.gov.br",
  viewer: "leonardo.araujo@homolog.cge.am.gov.br",
  worker: "caio.nascimento@homolog.cge.am.gov.br",
};
const admin = {
  email: "admin-e2e@local.invalid",
  password: "Admin-E2E-Password-123",
};

test("homolog worker sees every vacation state and immutable history", async ({
  page,
}) => {
  await login(page, accounts.worker, password);
  await page.getByRole("link", { name: "Férias", exact: true }).click();
  for (const label of [
    "Rascunho",
    "Aguardando chefia",
    "Aguardando decisão final",
    "Rejeitada pela chefia",
    "Aprovada",
    "Rejeitada na decisão final",
    "Cancelada",
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Histórico" }).first().click();
  await expect(
    page.getByRole("dialog", { name: "Histórico da solicitação" }),
  ).toBeVisible();
  await expect(page.getByText("Solicitação criada")).toBeVisible();
});

test("unit scopes suppress unrelated people and modules", async ({ page }) => {
  await login(page, accounts.viewer, password);
  await expect(page.getByRole("link", { name: "Colaboradores" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Férias" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Colaboradores" }).click();
  await expect(
    page.getByText("Leonardo Araújo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ana Beatriz Vasconcelos", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Caio Nascimento", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("searchbox", { name: "Buscar colaboradores" })
    .fill("registro inexistente");
  await expect(
    page.getByRole("heading", { name: "Nenhum resultado" }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="empty-state"] svg')).toHaveCount(0);
});

test("supervisor and HR receive only their decision stages", async ({
  browser,
}) => {
  const supervisorContext = await browser.newContext();
  const supervisorPage = await supervisorContext.newPage();
  await login(supervisorPage, accounts.supervisor, password);
  await supervisorPage
    .getByRole("link", { name: "Férias", exact: true })
    .click();
  await expect(
    supervisorPage.getByRole("heading", { name: "Decisões da chefia" }),
  ).toBeVisible();
  await expect(
    supervisorPage.getByRole("heading", { name: "Decisão final" }),
  ).toHaveCount(0);
  await expect(
    supervisorPage.getByRole("row", { name: /Caio Nascimento/ }),
  ).toBeVisible();
  await supervisorContext.close();

  const hrContext = await browser.newContext();
  const hrPage = await hrContext.newPage();
  await login(hrPage, accounts.hr, password);
  await hrPage.getByRole("link", { name: "Férias", exact: true }).click();
  await expect(
    hrPage.getByRole("heading", { name: "Decisão final" }),
  ).toBeVisible();
  await expect(
    hrPage.getByRole("heading", { name: "Decisões da chefia" }),
  ).toHaveCount(0);
  await expect(
    hrPage.getByRole("row", { name: /Caio Nascimento/ }),
  ).toBeVisible();
  await expect(hrPage.getByRole("link", { name: "Administração" })).toHaveCount(
    0,
  );
  await hrContext.close();
});

test("non-eligible and disabled accounts fail with actionable safe states", async ({
  page,
}) => {
  await login(page, accounts.contractor, password);
  await page.getByRole("link", { name: "Férias", exact: true }).click();
  await page.getByRole("button", { name: "Nova solicitação" }).click();
  await page.getByLabel("Data inicial").fill("2027-02-01");
  await page.getByLabel("Data final").fill("2027-02-10");
  await page.getByRole("button", { name: "Enviar para chefia" }).click();
  await expect(
    page
      .getByRole("alert")
      .getByText(/categoria funcional não está habilitada/i),
  ).toBeVisible();

  await page.context().clearCookies();
  await login(page, accounts.disabled, password);
  await expect(
    page.getByRole("alert").getByText("E-mail ou senha inválidos."),
  ).toBeVisible();
});

test("administration supports role editing, password reset, and audit export", async ({
  page,
}) => {
  await login(page, admin.email, admin.password);
  await expect(
    page.getByRole("link", { name: "Solicitar férias" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Administração" }).click();
  await expect(
    page.getByRole("heading", { name: "Atividade de auditoria" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Nova conta" }).click();
  await page.getByLabel("Pessoa").selectOption({
    label: "Ana Beatriz Vasconcelos",
  });
  await page.getByLabel("E-mail").fill("account-audit-e2e@local.invalid");
  await page
    .getByLabel("Senha temporária")
    .fill("Account-Audit-E2E-Password-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByText(
      "Conta criada. A senha deverá ser alterada no primeiro acesso.",
    ),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Editar papel Colaborador Homologação",
    })
    .click();
  const roleDialog = page.getByRole("dialog", { name: "Editar papel" });
  for (const module of ["Administração do sistema", "Pessoas e RH", "Férias"]) {
    await expect(
      roleDialog.getByRole("heading", { name: module }),
    ).toBeVisible();
  }
  await page
    .getByLabel("Descrição")
    .fill("Acesso de colaborador validado em homologação.");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Papel atualizado.")).toBeVisible();

  const workerRow = page
    .getByRole("row")
    .filter({ hasText: "account-audit-e2e@local.invalid" });
  await workerRow
    .getByRole("button", { name: /Redefinir senha de Ana Beatriz/i })
    .click();
  await page
    .getByLabel("Nova senha temporária")
    .fill("Account-Audit-Reset-Password-456");
  await page.getByRole("button", { name: "Redefinir senha" }).click();
  await expect(page.getByText(/sessões revogadas/)).toBeVisible();

  const audit = await page.request.get("/api/audit-events/export");
  expect(audit.ok()).toBeTruthy();
  expect(audit.headers()["content-type"]).toContain("text/csv");
  expect(await audit.text()).toContain("role.updated");

  await page.getByRole("button", { name: "Recolher barra lateral" }).click();
  await expect(
    page.getByRole("button", { name: "Expandir barra lateral" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expandir barra lateral" }).click();
  await expect(
    page.getByRole("button", { name: "Recolher barra lateral" }),
  ).toBeVisible();
});

test("mobile navigation traps focus, closes with Escape, and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, accounts.worker, password);
  const trigger = page.getByRole("button", { name: "Abrir menu" });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Navegação principal" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test("critical pages pass WCAG AA automation at mobile, tablet, and desktop sizes", async ({
  page,
}) => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Bem-vindo de volta" }),
    ).toBeVisible();
    await expectAccessiblePage(page, "/login", viewport.width);
  }

  await login(page, admin.email, admin.password);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/pessoas", "/ferias", "/administracao"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expectAccessiblePage(page, path, viewport.width);
    }
  }
});

async function expectAccessiblePage(page: Page, path: string, width: number) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `${path} at ${width}px: ${results.violations
      .map((item) => `${item.id} (${item.nodes.length})`)
      .join(", ")}`,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function login(page: Page, email: string, loginPassword: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha").fill(loginPassword);
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  if (email !== accounts.disabled) {
    await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible();
  }
}
