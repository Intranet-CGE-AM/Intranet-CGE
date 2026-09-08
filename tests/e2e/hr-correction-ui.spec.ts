import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15_000 });
test("servidor propõe nome preferido e vê a comparação sem alterar cadastro", async ({
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
    const { user } = await (
      await page.request.post("/api/auth/login", {
        headers,
        data: {
          email: "dandara.ribeiro@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    overrideId = (
      await (
        await admin.post("/api/admin/permission-overrides", {
          data: {
            accountId: user.account.id,
            permission: "hr_requests.create",
            effect: "allow",
            unitId: user.employment.unit.id,
          },
        })
      ).json()
    ).id;
    const before = await (await page.request.get("/api/me/dossier")).json();
    let failDossier = true;
    await page.route("**/api/me/dossier", async (route) => {
      if (failDossier) {
        failDossier = false;
        await route.fulfill({
          status: 500,
          json: { message: "Falha temporária no cadastro" },
        });
      } else await route.continue();
    });
    await page.goto("/rh/solicitacoes");
    await page.getByLabel("Tipo de solicitação").selectOption("correction");
    await page
      .getByRole("button", { name: "Tentar carregar cadastro" })
      .click();
    await page.getByLabel("Nome preferido proposto").fill("Dandara Interface");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.impeccable/review/correction-form-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByLabel("Como podemos ajudar?")
      .fill("Solicito a atualização do nome preferido.");
    await page
      .getByRole("button", { name: "Enviar solicitação", exact: true })
      .click();
    await expect(
      page.getByText("Dandara Interface", { exact: true }),
    ).toBeVisible();
    expect(
      (await (await page.request.get("/api/me/dossier")).json()).preferredName,
    ).toBe(before.preferredName);
    await expect(
      page.getByRole("heading", { name: "Alterações propostas" }).first(),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.impeccable/review/correction-result-${width}.png`,
        fullPage: true,
      });
    }
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await admin.dispose();
  }
});

test("chefe selecionado mantém o nome correto quando sai dos resultados da pesquisa", async ({
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
    const { user } = await (
      await page.request.post("/api/auth/login", {
        headers,
        data: {
          email: "dandara.ribeiro@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    overrideId = (
      await (
        await admin.post("/api/admin/permission-overrides", {
          data: {
            accountId: user.account.id,
            permission: "hr_requests.create",
            effect: "allow",
            unitId: user.employment.unit.id,
          },
        })
      ).json()
    ).id;
    const before = await (await page.request.get("/api/me/dossier")).json();
    const { supervisors, units } = await (
      await page.request.get("/api/employment-options?purpose=correction")
    ).json();
    const alternative = supervisors.find(
      (item: { id: string }) =>
        item.id !== before.employment.id &&
        item.id !== before.employment.supervisorRelationshipId,
    );
    expect(alternative).toBeTruthy();
    await page.goto("/rh/solicitacoes");
    await page.getByLabel("Tipo de solicitação").selectOption("correction");
    await page.getByText("Corrigir dados do vínculo", { exact: true }).click();
    const select = page.getByRole("combobox", { name: "Chefia proposta" });
    await select.click();
    await page
      .getByRole("option", { name: alternative.name, exact: true })
      .click();
    const destination = units.find(
      (item: { id: string }) => item.id !== before.employment.unitId,
    );
    const response = page.waitForResponse(
      (item) =>
        item.url().includes("/api/employment-options?") &&
        item.url().includes(`unitId=${destination.id}`),
    );
    await page.getByLabel("Unidade proposta").selectOption(destination.id);
    await response;
    await expect(select).toHaveText(alternative.name);
    await expect(
      page.locator('input[name="supervisorRelationshipId"]'),
    ).toHaveValue(alternative.id);
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await admin.dispose();
  }
});
