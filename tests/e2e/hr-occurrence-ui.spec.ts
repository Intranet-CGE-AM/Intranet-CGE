import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture.js";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15000 });
test("servidor envia ocorrência com comprovante e chefia decide sem dados privados", async ({
  page,
  playwright,
  browser,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  const chiefContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  const chiefPage = await chiefContext.newPage();
  const grants: string[] = [];
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
    for (const [context, email, permission] of [
      [
        page.request,
        "caio.nascimento@homolog.cge.am.gov.br",
        "occurrences.create",
      ],
      [
        chiefPage.request,
        "helena.monteiro@homolog.cge.am.gov.br",
        "occurrences.review.supervisor",
      ],
    ] as const) {
      const login = await context.post("/api/auth/login", {
        data: { email, password: "Homolog-Password-2026" },
      });
      expect(login.status()).toBe(200);
      const { user } = await login.json();
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: user.account.id,
          permission,
          effect: "allow",
          unitId: user.employment.unit.id,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
    }
    const docType = await admin.post("/api/document-types", {
      data: {
        name: "Comprovante da interface",
        purpose: "Analisar afastamento funcional",
        policyReference: "Política documental de homologação",
        retentionDays: 180,
        sensitive: true,
      },
    });
    expect(docType.status()).toBe(201);
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Ausência justificada da interface",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: true,
        affectsAvailability: true,
        documentTypeId: (await docType.json()).id,
      },
    });
    expect(type.status()).toBe(201);
    await page.goto("/rh/ocorrencias");
    await expect(
      page.getByRole("heading", {
        name: "Ocorrências e afastamentos",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nova ocorrência", exact: true })
      .click();
    await page
      .getByLabel("Tipo de ocorrência")
      .selectOption({ label: "Ausência justificada da interface" });
    await page.getByLabel("Data inicial").fill("2034-04-10");
    await page.getByLabel("Data final").fill("2034-04-12");
    await page
      .getByLabel("Justificativa")
      .fill("Conteúdo particular enviado para análise do RH autorizado.");
    await page.getByLabel("Comprovante PDF").setInputFiles({
      name: "comprovante.pdf",
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
      await page.screenshot({
        path: `.impeccable/review/occurrence-form-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Enviar ocorrência", exact: true })
      .click();
    await expect(
      page.getByText("Ocorrência enviada.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Justificativa")).toBeHidden();
    const { occurrences } = await (
      await page.request.get("/api/occurrences?scope=mine")
    ).json();
    const item = occurrences.find(
      (row: { typeName: string }) =>
        row.typeName === "Ausência justificada da interface",
    );
    expect(item).toMatchObject({ status: "submitted", version: 3 });
    await page
      .getByRole("button", { name: "Acompanhar ocorrência" })
      .first()
      .click();
    await expect(
      page.getByRole("link", { name: "Baixar comprovante" }),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.impeccable/review/occurrence-result-${width}.png`,
        fullPage: true,
      });
    }
    await chiefPage.goto("/rh/ocorrencias");
    await chiefPage
      .getByRole("button", { name: "Equipe", exact: true })
      .click();
    await chiefPage
      .getByRole("button", { name: "Acompanhar ocorrência" })
      .first()
      .click();
    await expect(
      chiefPage.getByText("Conteúdo particular", { exact: false }),
    ).toHaveCount(0);
    await expect(
      chiefPage.getByRole("link", { name: "Baixar comprovante" }),
    ).toHaveCount(0);
    for (const width of [1280, 390]) {
      await chiefPage.setViewportSize({ width, height: 844 });
      expect(
        (await new AxeBuilder({ page: chiefPage }).analyze()).violations,
      ).toEqual([]);
      expect(
        await chiefPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await chiefPage.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await chiefPage.screenshot({
        path: `.impeccable/review/occurrence-chief-${width}.png`,
        fullPage: true,
      });
    }
    await chiefPage
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();
    await expect(
      chiefPage.getByText("Ocorrência atualizada.", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await admin.post(`/api/occurrences/${item.id}/transition`, {
          data: { action: "approve", version: 4 },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Ausência justificada da interface" })
        .getByText("Aprovada", { exact: true }),
    ).toBeVisible();
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await chiefContext.close();
    await admin.dispose();
  }
});
