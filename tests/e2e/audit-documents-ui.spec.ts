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

test("Subcontroladoria e equipe editam o Word no navegador", async ({
  page,
}) => {
  const title = `Edição no navegador ${Date.now()}`;
  const editorBox = () =>
    page.getByRole("textbox", { name: "Conteúdo do documento" });
  const replaceParagraph = async (from: string, to: string) => {
    await editorBox().getByText(from, { exact: true }).click({ clickCount: 3 });
    await page.keyboard.type(to);
  };
  const saveVersion = async (note: string) => {
    await page.getByRole("button", { name: "Salvar nova versão" }).click();
    const dialog = page.getByRole("dialog", { name: "Salvar nova versão" });
    await dialog.getByLabel("Observação (opcional)").fill(note);
    await dialog.getByRole("button", { name: "Salvar versão" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
  };

  await signIn(page, auditAccounts.coordinatorA);
  const options = await page.request.get("/api/audit-documents/options");
  const { units } = (await options.json()) as {
    units: { id: string; name: string }[];
  };
  const created = await page.request.post("/api/audit-documents", {
    multipart: {
      metadata: JSON.stringify({
        unitId: units.find((unit) => unit.name === auditTeams.a)!.id,
        title,
      }),
      file: {
        name: "relatorio.docx",
        mimeType: docxMime,
        buffer: sampleDocx("Texto original da auditoria"),
      },
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await signIn(page, auditAccounts.reviewer);
  await page.goto(`/controle-interno/documentos/${id}`);
  await page.getByRole("link", { name: "Editar no navegador" }).click();
  await expect(
    page.getByText("A edição no navegador pode alterar a formatação do Word"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entendi" }).click();
  await expect(editorBox().locator("img")).toHaveCount(1);
  await replaceParagraph(
    "Texto original da auditoria",
    "Texto revisado pela Subcontroladoria",
  );
  await checkLayout(page);
  await saveVersion("Ajuste de redação.");

  await expect(page.getByRole("combobox", { name: "Versão" })).toHaveText(
    "Versão 2 (atual)",
  );
  await expect(
    page.getByText("Em revisão", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Versão editada pela Subcontroladoria").first(),
  ).toBeVisible();
  const viewer = page.frameLocator('iframe[title="Visualização da versão 2"]');
  await expect(
    viewer.getByText("Texto revisado pela Subcontroladoria"),
  ).toBeVisible();
  await expect(viewer.locator("img")).toHaveCount(1);

  // The edited file is a real .docx: it passes the upload validator again.
  const detail = (await (
    await page.request.get(`/api/audit-documents/${id}`)
  ).json()) as { files: { id: string; number: number }[] };
  const v2 = detail.files.find((file) => file.number === 2)!;
  const edited = await page.request.get(
    `/api/audit-documents/${id}/files/${v2.id}?disposition=attachment`,
  );
  const buffer = await edited.body();
  expect(buffer.subarray(0, 2).toString()).toBe("PK");

  const correction = await page.request.post(
    `/api/audit-documents/${id}/transition`,
    {
      data: {
        action: "request_correction",
        version: (
          (await (
            await page.request.get(`/api/audit-documents/${id}`)
          ).json()) as { version: number }
        ).version,
        message: "Detalhe o achado principal.",
      },
    },
  );
  expect(correction.status()).toBe(200);

  await signIn(page, auditAccounts.coordinatorA);
  const recheck = await page.request.post("/api/audit-documents", {
    multipart: {
      metadata: JSON.stringify({
        unitId: units.find((unit) => unit.name === auditTeams.a)!.id,
        title: `${title} (revalidação)`,
      }),
      file: { name: "editado.docx", mimeType: docxMime, buffer },
    },
  });
  expect(recheck.status()).toBe(201);

  await page.goto(`/controle-interno/documentos/${id}`);
  await page.getByRole("link", { name: "Editar no navegador" }).click();
  await replaceParagraph(
    "Texto revisado pela Subcontroladoria",
    "Texto corrigido pela equipe",
  );
  await saveVersion("Achado detalhado.");
  await expect(
    page.getByText("Em revisão", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Versão" })).toHaveText(
    "Versão 3 (atual)",
  );
  await expect(
    page
      .frameLocator('iframe[title="Visualização da versão 3"]')
      .getByText("Texto corrigido pela equipe"),
  ).toBeVisible();
});
