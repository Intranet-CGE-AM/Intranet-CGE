import AxeBuilder from "@axe-core/playwright";

import {
  auditAccounts,
  auditTeams,
  docxMime,
  sampleDocx,
  searchablePdf,
} from "./audit-document-fixtures";
import { chooseOption, expect, test, type Page } from "./fixtures";

test.use({ actionTimeout: 15_000 });

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha").fill("Homolog-Password-2026");
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: /(Bom dia|Boa tarde|Boa noite),/ }),
  ).toBeVisible();
}

async function checkLayout(page: Page) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      (
        await new AxeBuilder({ page })
          // The viewer frame holds the uploaded file, sandboxed without scripts.
          .exclude("iframe[sandbox]")
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 844 });
}

async function openDocument(page: Page, title: string, tab: string) {
  await page.goto("/controle-interno/documentos");
  await page.getByRole("button", { name: new RegExp(`^${tab}`) }).click();
  await page.getByLabel("Buscar documentos").fill(title);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
}

test("equipe envia, Subcontroladoria revisa, aprova e reabre pela interface", async ({
  page,
}) => {
  const title = `Relatório UI ${Date.now()}`;
  const status = (label: string) =>
    expect(page.locator("main").getByText(label, { exact: true }).first());

  await signIn(page, auditAccounts.coordinatorA);
  await page
    .getByRole("link", { name: /Controle Interno/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Documentos de auditoria" }),
  ).toBeVisible();
  await checkLayout(page);

  await page.getByRole("button", { name: "Enviar documento" }).first().click();
  const upload = page.getByRole("dialog", { name: "Enviar documento" });
  await chooseOption(upload, "Equipe", auditTeams.a);
  await upload.getByLabel("Título").fill(title);
  await upload.getByLabel("Categoria (opcional)").fill("Relatório preliminar");
  await expect(
    upload.getByText("PDF precisa ter texto pesquisável (OCR)", {
      exact: false,
    }),
  ).toBeVisible();
  await upload.getByLabel("Arquivo").setInputFiles({
    name: "relatorio.docx",
    mimeType: docxMime,
    buffer: sampleDocx("Achados da auditoria de teste"),
  });
  await upload.getByRole("button", { name: "Enviar documento" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await status("Em revisão").toBeVisible();
  const viewer = page.frameLocator('iframe[title="Visualização da versão 1"]');
  await expect(viewer.getByText("Achados da auditoria de teste")).toBeVisible();
  await expect(viewer.locator("img")).toHaveCount(1);
  expect(
    await viewer
      .locator("img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  // The team cannot decide on its own document.
  await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Solicitar correção" }),
  ).toHaveCount(0);
  await checkLayout(page);

  await signIn(page, auditAccounts.reviewer);
  await openDocument(page, title, "Em revisão");
  await page.reload();
  await expect(
    page.getByText(/Visualizado por Subcontroladoria SCI/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar nova versão" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Solicitar correção" }).click();
  const correction = page.getByRole("dialog", { name: "Solicitar correção" });
  await expect(
    correction.getByLabel("O que precisa ser corrigido"),
  ).toHaveAttribute("required", "");
  await correction
    .getByLabel("O que precisa ser corrigido")
    .fill("Inclua a matriz de achados no anexo.");
  await correction.getByRole("button", { name: "Solicitar correção" }).click();
  await expect(correction).toBeHidden();
  await status("Aguardando correção").toBeVisible();

  await signIn(page, auditAccounts.coordinatorA);
  await openDocument(page, title, "Aguardando correção");
  await expect(
    page.getByText("Inclua a matriz de achados no anexo.").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enviar nova versão" }).click();
  const version = page.getByRole("dialog", { name: "Enviar nova versão" });
  await version.getByLabel("Arquivo").setInputFiles({
    name: "relatorio-v2.pdf",
    mimeType: "application/pdf",
    buffer: searchablePdf(
      "Relatorio de auditoria corrigido com matriz de achados",
    ),
  });
  await version.getByLabel("Observação (opcional)").fill("Matriz incluída.");
  await version.getByRole("button", { name: "Enviar versão" }).click();
  await expect(version).toBeHidden();
  await status("Em revisão").toBeVisible();
  await expect(page.getByRole("combobox", { name: "Versão" })).toHaveText(
    "Versão 2 (atual)",
  );

  await signIn(page, auditAccounts.reviewer);
  await openDocument(page, title, "Em revisão");
  await page.getByRole("button", { name: "Aprovar" }).click();
  await page
    .getByRole("alertdialog", { name: "Aprovar documento?" })
    .getByRole("button", { name: "Aprovar documento" })
    .click();
  await status("Aprovado").toBeVisible();

  await page.goto("/controle-interno/documentos?tab=approved");
  await page.getByLabel("Buscar documentos").fill(title);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: `Baixar ${title}` }).click();
  expect((await download).suggestedFilename()).toBe("relatorio-v2.pdf");
  await checkLayout(page);

  await page.getByRole("link", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Reabrir" }).click();
  const reopen = page.getByRole("dialog", { name: "Reabrir documento" });
  await reopen.getByLabel("Motivo").fill("Nova evidência recebida.");
  await reopen.getByRole("button", { name: "Reabrir documento" }).click();
  await expect(reopen).toBeHidden();
  await status("Em revisão").toBeVisible();
  await expect(page.getByText("Documento reaberto").first()).toBeVisible();
  await checkLayout(page);
});

test("módulo fica oculto para quem não tem permissão", async ({ page }) => {
  await signIn(page, auditAccounts.noAccess);
  await expect(
    page.getByRole("link", { name: /Controle Interno/ }),
  ).toHaveCount(0);
  await page.goto("/controle-interno/documentos");
  await expect(page).toHaveURL(/\/$/);
});

test("indicadores exigem a chave de relatórios e exportam PDF", async ({
  page,
}) => {
  await signIn(page, auditAccounts.assessorA);
  await page.goto("/controle-interno/documentos");
  await expect(page.getByRole("link", { name: "Indicadores" })).toHaveCount(0);
  await page.goto("/controle-interno/indicadores");
  await expect(page).toHaveURL(/\/$/);

  await signIn(page, auditAccounts.reviewer);
  await page.goto("/controle-interno/documentos");
  await page.getByRole("link", { name: "Indicadores" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Indicadores de auditoria" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pendências por equipe" }),
  ).toBeVisible();
  await checkLayout(page);

  const limit = page.getByLabel("Rodadas de correção", { exact: true });
  const previous = await limit.inputValue();
  for (const value of ["2", previous]) {
    await limit.fill(value);
    await page.getByRole("button", { name: "Salvar limite" }).click();
    await expect(page.getByText("Limite de gargalo atualizado.")).toBeVisible();
    await expect(page.getByText(`Gargalo a partir de ${value}`)).toBeVisible();
  }

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Relatório analítico" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^relatorio-analitico-.*\.pdf$/);
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
});
