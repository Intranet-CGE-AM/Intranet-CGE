import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture.js";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15000 });
test("servidor envia certificado, RH valida e capacitação aparece no dossiê", async ({
  page,
  browser,
}) => {
  const adminContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  const admin = await adminContext.newPage();
  let grantId: string | undefined;
  try {
    expect(
      (
        await admin.request.post("/api/auth/login", {
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
    const grant = await admin.request.post("/api/admin/permission-overrides", {
      data: {
        accountId: user.account.id,
        permission: "training.create",
        effect: "allow",
        unitId: user.employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    const policy = await admin.request.post("/api/document-types", {
      data: {
        name: "Certificado da interface",
        purpose: "Validar capacitações internas",
        policyReference: "Política documental de homologação",
        retentionDays: 365,
        sensitive: false,
      },
    });
    expect(policy.status()).toBe(201);
    await admin.goto("/rh/capacitacoes");
    await expect(
      admin.getByRole("heading", { name: "Capacitações", exact: true }),
    ).toBeVisible();
    await admin.getByText("Configurar certificados", { exact: true }).click();
    await admin
      .getByLabel("Política documental dos certificados")
      .selectOption({ label: "Certificado da interface" });
    await admin.getByRole("button", { name: "Salvar configuração" }).click();
    await expect(
      admin.getByText("Configuração salva.", { exact: true }),
    ).toBeVisible();
    await admin.getByText("Configurar certificados", { exact: true }).click();
    await page.goto("/rh/capacitacoes");
    await page
      .getByRole("button", { name: "Registrar capacitação", exact: true })
      .click();
    await page
      .getByLabel("Título da capacitação")
      .fill("Gestão pública aplicada à rotina");
    await page
      .getByLabel("Instituição")
      .fill("Escola de Governo de homologação");
    await page.getByLabel("Data inicial").fill("2026-06-01");
    await page.getByLabel("Data final").fill("2026-06-05");
    await page.getByLabel("Carga horária (horas)").fill("20");
    await page.getByLabel("Certificado PDF").setInputFiles({
      name: "certificado.pdf",
      mimeType: "application/pdf",
      buffer: blankPdf,
    });
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
        path: `.impeccable/review/training-form-${width}.png`,
        fullPage: true,
      });
    }
    await page.route(
      "**/api/training",
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Envio temporariamente indisponível.",
          }),
        }),
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Enviar capacitação", exact: true })
      .click();
    await expect(
      page.getByText("Envio temporariamente indisponível.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Título da capacitação")).toHaveValue(
      "Gestão pública aplicada à rotina",
    );
    await page
      .getByRole("button", { name: "Enviar capacitação", exact: true })
      .click();
    await expect(
      page.getByText("Capacitação enviada para validação.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Título da capacitação")).toBeHidden();
    const rows = (
      await (await page.request.get("/api/training?scope=mine")).json()
    ).records.filter(
      (row: { title: string }) =>
        row.title === "Gestão pública aplicada à rotina",
    );
    expect(rows).toHaveLength(1);
    await admin.reload();
    await admin
      .getByRole("button", { name: "Analisar capacitações", exact: true })
      .click();
    const record = admin.getByRole("article").filter({
      has: admin.getByRole("heading", {
        name: "Gestão pública aplicada à rotina",
        exact: true,
      }),
    });
    const follow = record.getByRole("button", {
      name: "Acompanhar capacitação",
    });
    let releaseDetail!: () => void;
    let detailStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      detailStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseDetail = resolve;
    });
    await admin.route(
      `**/api/training/${rows[0].id}`,
      async (route) => {
        detailStarted();
        await gate;
        await route.continue();
      },
      { times: 1 },
    );
    try {
      await follow.focus();
      await follow.press("Enter");
      await started;
      await expect(follow).toBeFocused();
    } finally {
      releaseDetail();
    }
    await expect(follow).toHaveAttribute("aria-expanded", "true");
    await expect(follow).toBeFocused();
    await expect(
      record.getByRole("link", { name: "Baixar certificado" }),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await admin.setViewportSize({ width, height: 844 });
      expect(
        (await new AxeBuilder({ page: admin }).analyze()).violations,
      ).toEqual([]);
      expect(
        await admin.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await admin.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await admin.screenshot({
        path: `.impeccable/review/training-review-${width}.png`,
        fullPage: true,
      });
    }
    await record.getByRole("button", { name: "Validar", exact: true }).click();
    await expect(
      admin.getByText("Capacitação atualizada.", { exact: true }),
    ).toBeVisible();
    await page.goto("/rh/meu-dossie");
    const section = page.getByRole("region", {
      name: "Capacitações validadas",
    });
    await expect(
      section.getByText("Gestão pública aplicada à rotina", { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole("link", { name: "Baixar certificado" }).first(),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await section.screenshot({
        path: `.impeccable/review/training-dossier-${width}.png`,
      });
    }
    await record.getByRole("button", { name: "Arquivar", exact: true }).click();
    const confirmation = admin.getByRole("alertdialog");
    await expect(confirmation).toContainText("O histórico será preservado.");
    await confirmation
      .getByRole("button", { name: "Arquivar", exact: true })
      .click();
    await expect(
      record.getByText("Arquivada", { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      section.getByText("Gestão pública aplicada à rotina", { exact: true }),
    ).toBeHidden();
  } finally {
    if (grantId)
      await admin.request.delete(`/api/admin/permission-overrides/${grantId}`);
    await admin.request.put("/api/training-settings", {
      data: { certificateTypeId: null },
    });
    await adminContext.close();
  }
});
