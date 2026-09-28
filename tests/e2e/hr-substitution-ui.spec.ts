import AxeBuilder from "@axe-core/playwright";
import { clientHeaders, expect, test } from "./fixtures";

test("RH cadastra, altera e cancela substituição com campos claros e recuperação por teclado", async ({
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
  await page.goto("/rh/substituicoes");
  await expect(
    page.getByRole("heading", {
      name: "Substituições temporárias",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nova substituição" }).click();
  await page
    .getByLabel("Unidade da substituição")
    .selectOption({ label: "Tecnologia da Informação" });
  await page.getByLabel("Responsável original").fill("Helena");
  await page
    .getByRole("button", { name: "Selecionar Helena Monteiro" })
    .click();
  await expect(page.getByLabel("Responsável original")).toBeFocused();
  await page.getByLabel("Substituto").fill("Leonardo");
  await page
    .getByRole("button", { name: "Selecionar Leonardo Araújo" })
    .click();
  await page.getByLabel("Início da substituição").fill("2026-01-01");
  await page.getByLabel("Fim da substituição").fill("2040-12-31");
  await page
    .getByLabel("Motivo")
    .fill("Cobertura temporária da chefia durante afastamento.");
  await page.getByLabel("Férias — análise da chefia", { exact: true }).check();
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
      path: `.impeccable/review/substitutions-form-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Salvar substituição", exact: true })
    .click();
  await expect(
    page.getByText("Substituição salva.", { exact: true }),
  ).toBeVisible();
  const record = page
    .getByRole("listitem")
    .filter({ hasText: "Cobertura temporária da chefia durante afastamento." });
  await expect(record).toContainText("Helena Monteiro");
  await expect(record).toContainText("Leonardo Araújo");
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
      path: `.impeccable/review/substitutions-list-${width}.png`,
      fullPage: true,
    });
  }
  await record.getByRole("button", { name: "Cancelar substituição" }).click();
  await page.getByRole("button", { name: "Nova substituição" }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar cancelamento" }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Nova substituição" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Fechar formulário" }).click();
  await record.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Fim da substituição").fill("2039-12-31");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/substitutions/*",
    async (route) => {
      await held;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Serviço temporariamente indisponível.",
        }),
      });
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Salvar substituição", exact: true })
    .click();
  try {
    await expect(
      page.getByRole("button", { name: "Nova substituição" }),
    ).toBeDisabled();
    await expect(page.getByLabel("Fim da substituição")).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByText("Serviço temporariamente indisponível."),
  ).toBeVisible();
  await expect(page.getByLabel("Fim da substituição")).toHaveValue(
    "2039-12-31",
  );
  await page
    .getByRole("button", { name: "Salvar substituição", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(record).toContainText("31/12/2039");
  await record.getByRole("button", { name: "Cancelar substituição" }).click();
  await record.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(record).toContainText("Cancelada");
});

test("pendência explica origem da substituição e atualiza acesso sem recarregar a página", async ({
  page,
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  const chief = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  let id = "";
  try {
    await admin.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const original = await (
      await chief.post("/api/auth/login", {
        data: {
          email: "helena.monteiro@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    const recipient = await (
      await page.request.post("/api/auth/login", {
        data: {
          email: "leonardo.araujo@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    await page.goto("/rh/pendencias");
    await expect(
      page.getByRole("heading", { name: "Minhas pendências", exact: true }),
    ).toBeVisible();
    const created = await admin.post("/api/substitutions", {
      data: {
        originalAccountId: original.user.account.id,
        substituteAccountId: recipient.user.account.id,
        unitId: original.user.employment.unit.id,
        startsOn: "2026-01-01",
        endsOn: "2040-12-31",
        reason: "Cobertura temporária para continuidade da análise.",
        flows: ["vacations.review.supervisor"],
      },
    });
    expect(created.status()).toBe(201);
    id = (await created.json()).id;
    await page.getByRole("button", { name: "Atualizar pendências" }).click();
    await expect(
      page
        .getByText("Por substituição de Helena Monteiro", { exact: true })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("link", { name: /^Abrir: Analisar férias/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/rh\/ferias/);
    await expect(
      page.getByText("Acesso restrito", { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Férias", exact: true }),
    ).toBeVisible();
  } finally {
    if (id)
      await admin.post(`/api/substitutions/${id}/cancel`, {
        data: { version: 1 },
      });
    await admin.dispose();
    await chief.dispose();
  }
});
