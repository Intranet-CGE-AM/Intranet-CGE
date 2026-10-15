import type { APIRequestContext } from "@playwright/test";

import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxFile,
  docxMime,
  pdfFile,
  sampleDocx,
  signIn,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { checkLayout, richDocx, signInPage } from "./audit-ui-fixtures";
import { expect, test, type Page } from "./fixtures";

test.use({ actionTimeout: 15_000, timezoneId: "America/Manaus" });

type Doc = { id: string; version: number; fileCount: number };

const editorBox = (page: Page) =>
  page.getByRole("textbox", { name: "Conteúdo do documento" });

async function clients(
  playwright: Parameters<typeof signIn>[0],
  baseURL: string,
) {
  const [team, reviewer] = await Promise.all([
    signIn(playwright, baseURL, auditAccounts.coordinatorA),
    signIn(playwright, baseURL, auditAccounts.reviewer),
  ]);
  return {
    team,
    reviewer,
    dispose: () => Promise.all([team.dispose(), reviewer.dispose()]),
  };
}

async function submit(
  team: APIRequestContext,
  title: string,
  file: { name: string; mimeType: string; buffer: Buffer } = docxFile(),
) {
  const response = await createDocument(
    team,
    { unitId: await unitId(team, auditTeams.a), title },
    file,
  );
  expect(response.status()).toBe(201);
  return (await response.json()) as Doc;
}

async function current(client: APIRequestContext, id: string) {
  return (await (await client.get(`/api/audit-documents/${id}`)).json()) as Doc;
}

async function openEditor(page: Page, id: string) {
  await page.goto(`/controle-interno/documentos/${id}`);
  await page.getByRole("link", { name: "Editar no navegador" }).click();
  await expect(editorBox(page)).toBeVisible();
  const notice = page.getByRole("button", { name: "Entendi" });
  if (await notice.isVisible()) await notice.click();
}

async function typeAtEnd(page: Page, paragraph: string, text: string) {
  await editorBox(page).getByText(paragraph, { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

const draftOf = (page: Page, id: string) =>
  page.evaluate(
    (key) => window.localStorage.getItem(key),
    `audit-editor:draft:${id}`,
  );

async function saveVersion(page: Page, title: string) {
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await page
    .getByRole("dialog", { name: "Salvar nova versão" })
    .getByRole("button", { name: "Salvar versão" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
}

test("editor mantém cada elemento do Word ao salvar e reabrir", async ({
  page,
  playwright,
  baseURL,
}) => {
  const title = `Fidelidade do editor ${Date.now()}`;
  const api = await clients(playwright, baseURL!);
  try {
    const doc = await submit(api.team, title, {
      name: "completo.docx",
      mimeType: docxMime,
      buffer: richDocx(),
    });
    await signInPage(page, auditAccounts.reviewer);
    await openEditor(page, doc.id);
    const editor = editorBox(page);

    await expect(editor.locator("h1")).toHaveText("Relatório de auditoria");
    await expect(editor.locator("h2")).toHaveText("Achados");
    await expect(editor.locator("h3")).toHaveText("Detalhe do achado");
    await expect(editor.locator("strong")).toHaveText("forte");
    await expect(editor.locator("em")).toHaveText("inclinado");
    await expect(editor.locator("u")).toHaveText("sublinhado");
    await expect(editor.locator(":scope > ul > li")).toHaveCount(2);
    await expect(editor.locator("ul > li > ol > li")).toHaveText([
      "Passo 1",
      "Passo 2",
    ]);
    await expect(editor.locator("table th")).toHaveText(["Achado", "Risco"]);
    await expect(editor.locator("table td")).toHaveText(["Falha", "Alto"]);
    await expect(editor.locator('img[alt="Gráfico de achados"]')).toHaveCount(
      1,
    );
    await expect(editor.locator('p[style*="text-align: center"]')).toHaveText(
      "Texto centralizado",
    );
    await expect(editor.locator('p[style*="text-align: justify"]')).toHaveText(
      "Texto justificado",
    );
    expect(
      await editor
        .locator("a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual([
      "https://www.cge.am.gov.br/",
      "http://intranet.local/",
      "mailto:sci@cge.am.gov.br",
    ]);
    // The javascript: link loses the link, keeps the text.
    await expect(editor.getByText("clique")).toBeVisible();
    const original = await editor.innerHTML();

    await checkLayout(page);
    await page.getByRole("button", { name: "Link", exact: true }).click();
    const linkDialog = page.getByRole("dialog", { name: "Link" });
    await expect(linkDialog).toBeVisible();
    await checkLayout(page);
    await linkDialog.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Salvar nova versão" }).click();
    const save = page.getByRole("dialog", { name: "Salvar nova versão" });
    await expect(save).toBeVisible();
    await checkLayout(page);
    await save.getByRole("button", { name: "Salvar versão" }).click();
    await expect(page.getByRole("combobox", { name: "Versão" })).toHaveText(
      "Versão 2 (atual)",
    );

    // Word -> editor -> Word -> editor gives back the same document.
    await openEditor(page, doc.id);
    await expect(
      page.getByText("Editando a versão 2", { exact: false }),
    ).toBeVisible();
    expect(await editor.innerHTML()).toBe(original);
  } finally {
    await api.dispose();
  }
});

test("rascunho do editor é salvo sozinho e recuperado", async ({
  page,
  playwright,
  baseURL,
}) => {
  const title = `Rascunho do editor ${Date.now()}`;
  const api = await clients(playwright, baseURL!);
  try {
    const doc = await submit(api.team, title, {
      name: "rascunho.docx",
      mimeType: docxMime,
      buffer: sampleDocx("Texto original do rascunho"),
    });
    await signInPage(page, auditAccounts.reviewer);
    // Reloading with unsaved edits asks first; the test accepts.
    page.on("dialog", (dialog) => void dialog.accept());
    await openEditor(page, doc.id);
    await typeAtEnd(page, "Texto original do rascunho", " com acréscimo");
    await expect
      .poll(() => draftOf(page, doc.id))
      .toContain("Texto original do rascunho com acréscimo");

    await page.reload();
    const alert = page.getByRole("status").filter({
      hasText: "Há um rascunho não salvo",
    });
    await expect(alert).toContainText(
      "O navegador guardou edições desta versão",
    );
    // Not applied until the person asks.
    await expect(editorBox(page)).not.toContainText("com acréscimo");
    await alert.getByRole("button", { name: "Recuperar rascunho" }).click();
    await expect(alert).toBeHidden();
    await expect(editorBox(page)).toContainText(
      "Texto original do rascunho com acréscimo",
    );

    // Saving clears the draft.
    await saveVersion(page, title);
    expect(await draftOf(page, doc.id)).toBeNull();
    await openEditor(page, doc.id);
    await expect(
      page.getByText("Há um rascunho não salvo", { exact: true }),
    ).toHaveCount(0);

    // A draft made on an older version is flagged, not applied.
    await typeAtEnd(
      page,
      "Texto original do rascunho com acréscimo",
      " e mais",
    );
    await expect.poll(() => draftOf(page, doc.id)).toContain(" e mais");
    const latest = await current(api.reviewer, doc.id);
    expect(
      (
        await uploadVersion(
          api.reviewer,
          doc.id,
          { version: latest.version, source: "editor" },
          docxFile("outra-edicao.docx"),
        )
      ).status(),
    ).toBe(201);
    await page.reload();
    await expect(alert).toContainText(
      "O rascunho foi feito sobre a versão 2, e a versão atual é a 3.",
    );
    await expect(editorBox(page)).not.toContainText(" e mais");
    await alert.getByRole("button", { name: "Descartar" }).click();
    await expect(alert).toBeHidden();
    expect(await draftOf(page, doc.id)).toBeNull();
  } finally {
    await api.dispose();
  }
});

test("sair do editor com edições pede confirmação", async ({
  page,
  playwright,
  baseURL,
}) => {
  const title = `Saída do editor ${Date.now()}`;
  const api = await clients(playwright, baseURL!);
  try {
    const doc = await submit(api.team, title, {
      name: "saida.docx",
      mimeType: docxMime,
      buffer: sampleDocx("Texto antes de sair"),
    });
    await signInPage(page, auditAccounts.reviewer);
    await openEditor(page, doc.id);
    const editorUrl = page.url();

    // Without edits, leaving needs no confirmation.
    await page.getByRole("button", { name: "Voltar ao documento" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();

    await openEditor(page, doc.id);
    await typeAtEnd(page, "Texto antes de sair", " e depois");
    const leave = page.getByRole("dialog", { name: "Sair sem salvar?" });
    await page.getByRole("button", { name: "Voltar ao documento" }).click();
    await expect(leave).toBeVisible();
    await checkLayout(page);
    await leave.getByRole("button", { name: "Continuar editando" }).click();
    await expect(leave).toBeHidden();
    expect(page.url()).toBe(editorUrl);
    await expect(editorBox(page)).toContainText("Texto antes de sair e depois");

    // Closing the tab asks the browser.
    const asked = new Promise<string>((resolve) =>
      page.once("dialog", (dialog) => {
        resolve(dialog.type());
        void dialog.dismiss();
      }),
    );
    await page.close({ runBeforeUnload: true });
    expect(await asked).toBe("beforeunload");
    expect(page.isClosed()).toBe(false);

    // An in-app link asks too; leaving keeps the text as a draft.
    await page.getByRole("link", { name: "Indicadores" }).click();
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Sair sem salvar" }).click();
    await expect(page).toHaveURL(/\/controle-interno\/indicadores/);
    expect(await draftOf(page, doc.id)).toContain("e depois");
    expect((await current(api.reviewer, doc.id)).fileCount).toBe(1);
  } finally {
    await api.dispose();
  }
});

test("editor só abre na versão atual em Word, para quem pode editar", async ({
  page,
  playwright,
  baseURL,
}) => {
  const stamp = Date.now();
  const api = await clients(playwright, baseURL!);
  const blocked = async (id: string) => {
    await page.goto(`/controle-interno/documentos/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Editar no navegador" }),
    ).toHaveCount(0);
    await page.goto(`/controle-interno/documentos/${id}/editar`);
    await expect(page.getByText("Editor indisponível")).toBeVisible();
    await expect(editorBox(page)).toHaveCount(0);
  };
  try {
    const pdf = await submit(api.team, `Editor PDF ${stamp}`, pdfFile());
    const word = await submit(api.team, `Editor Word ${stamp}`);
    const approved = await submit(api.team, `Editor aprovado ${stamp}`);
    const cancelled = await submit(api.team, `Editor cancelado ${stamp}`);
    const act = async (
      client: APIRequestContext,
      doc: Doc,
      action: string,
      message?: string,
    ) =>
      expect(
        (
          await client.post(`/api/audit-documents/${doc.id}/transition`, {
            data: { action, version: doc.version, message },
          })
        ).status(),
      ).toBe(200);
    await act(api.reviewer, approved, "approve");
    await act(api.team, cancelled, "cancel", "Duplicado.");

    // PDF: view only, for everyone.
    await signInPage(page, auditAccounts.reviewer);
    await blocked(pdf.id);
    await expect(
      page.getByText("Só a versão atual em Word (.docx)", { exact: false }),
    ).toBeVisible();
    // Approved: nobody edits.
    await blocked(approved.id);

    // In review: the team edits too. Cancelled: nobody does.
    await signInPage(page, auditAccounts.coordinatorA);
    await page.goto(`/controle-interno/documentos/${word.id}`);
    await expect(
      page.getByRole("link", { name: "Editar no navegador" }),
    ).toBeVisible();
    await blocked(cancelled.id);

    // Correction requested: the team edits, the reviewer does not.
    await act(api.reviewer, word, "request_correction", "Ajustar.");
    await page.goto(`/controle-interno/documentos/${word.id}`);
    await expect(
      page.getByRole("link", { name: "Editar no navegador" }),
    ).toBeVisible();
    await signInPage(page, auditAccounts.reviewer);
    await blocked(word.id);
  } finally {
    await api.dispose();
  }
});

test("salvar sobre versão desatualizada mostra conflito e recarrega", async ({
  page,
  playwright,
  baseURL,
}) => {
  const title = `Conflito do editor ${Date.now()}`;
  const api = await clients(playwright, baseURL!);
  try {
    const doc = await submit(api.team, title, {
      name: "conflito.docx",
      mimeType: docxMime,
      buffer: sampleDocx("Texto em disputa"),
    });
    await signInPage(page, auditAccounts.reviewer);
    await openEditor(page, doc.id);
    await typeAtEnd(page, "Texto em disputa", " pela primeira revisora");

    // Meanwhile another reviewer session saves an edited version.
    expect(
      (
        await uploadVersion(
          api.reviewer,
          doc.id,
          { version: doc.version, source: "editor" },
          docxFile("paralela.docx"),
        )
      ).status(),
    ).toBe(201);

    await page.getByRole("button", { name: "Salvar nova versão" }).click();
    const save = page.getByRole("dialog", { name: "Salvar nova versão" });
    await save.getByRole("button", { name: "Salvar versão" }).click();
    await expect(save.getByRole("alert")).toContainText(
      "Outra pessoa salvou ou mudou este documento",
    );
    // The open dialog hides the page from the accessibility tree.
    await expect(page.locator(".ProseMirror")).toContainText(
      "Texto em disputa pela primeira revisora",
    );
    expect((await current(api.reviewer, doc.id)).fileCount).toBe(2);

    await save.getByRole("button", { name: "Recarregar documento" }).click();
    await expect(
      page.getByText("Editando a versão 2", { exact: false }),
    ).toBeVisible();
    const alert = page.getByRole("status").filter({
      hasText: "Há um rascunho não salvo",
    });
    await expect(alert).toContainText(
      "O rascunho foi feito sobre a versão 1, e a versão atual é a 2.",
    );
    await alert.getByRole("button", { name: "Recuperar rascunho" }).click();
    await expect(editorBox(page)).toContainText(
      "Texto em disputa pela primeira revisora",
    );
  } finally {
    await api.dispose();
  }
});

test("equipe edita no navegador com o documento em análise", async ({
  page,
  playwright,
  baseURL,
}) => {
  const title = `Edição da equipe em análise ${Date.now()}`;
  const api = await clients(playwright, baseURL!);
  try {
    const doc = await submit(api.team, title, {
      name: "analise.docx",
      mimeType: docxMime,
      buffer: sampleDocx("Texto enviado para análise"),
    });
    await signInPage(page, auditAccounts.assessorA);
    await openEditor(page, doc.id);
    await typeAtEnd(
      page,
      "Texto enviado para análise",
      " com ajuste da equipe",
    );
    await page.getByRole("button", { name: "Salvar nova versão" }).click();
    const save = page.getByRole("dialog", { name: "Salvar nova versão" });
    // The team's version is not announced as a reviewer edit.
    await expect(save).toContainText(
      "A nova versão volta para revisão da Subcontroladoria.",
    );
    await checkLayout(page);
    await save.getByRole("button", { name: "Salvar versão" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Versão" })).toHaveText(
      "Versão 2 (atual)",
    );
    await expect(
      page.getByText("Em revisão", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Nova versão enviada").first()).toBeVisible();
    await expect(
      page.getByText("Versão editada pela Subcontroladoria"),
    ).toHaveCount(0);
    await expect(
      page
        .frameLocator('iframe[title="Visualização da versão 2"]')
        .getByText("Texto enviado para análise com ajuste da equipe"),
    ).toBeVisible();
    expect(await current(api.reviewer, doc.id)).toMatchObject({
      status: "in_review",
      version: 2,
      fileCount: 2,
    });
  } finally {
    await api.dispose();
  }
});
