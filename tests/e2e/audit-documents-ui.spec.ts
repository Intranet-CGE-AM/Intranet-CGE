import type { APIRequestContext } from "@playwright/test";

import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxMime,
  pdfFile,
  sampleDocx,
  searchablePdf,
  signIn as apiSignIn,
  unitId as teamId,
  uploadVersion,
} from "./audit-document-fixtures";
import { checkLayout, signInPage as signIn } from "./audit-ui-fixtures";
import { chooseOption, expect, test, type Page } from "./fixtures";
import { blankPdf } from "./pdf-fixture";

test.use({ actionTimeout: 15_000, timezoneId: "America/Manaus" });

type Doc = { id: string; version: number };

async function act(
  client: APIRequestContext,
  doc: Doc,
  action: string,
  message?: string,
) {
  const response = await client.post(
    `/api/audit-documents/${doc.id}/transition`,
    { data: { action, version: doc.version, message } },
  );
  expect(response.status()).toBe(200);
  doc.version = ((await response.json()) as Doc).version;
}

/** Counts transition requests, to prove a blocked form sent nothing. */
function transitions(page: Page) {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().includes("/transition")) count += 1;
  });
  return () => count;
}

const actionButtons = [
  "Aprovar",
  "Solicitar correção",
  "Editar no navegador",
  "Enviar nova versão",
  "Reabrir",
  "Cancelar",
] as const;

/** Only the given document actions are offered (the rest are absent). */
async function expectActions(page: Page, visible: string[]) {
  for (const name of actionButtons) {
    const control = page
      .getByRole("main")
      .getByRole(name === "Editar no navegador" ? "link" : "button", {
        name,
        exact: true,
      });
    if (visible.includes(name)) await expect(control).toBeVisible();
    else await expect(control).toHaveCount(0);
  }
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
  await checkLayout(page);
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
  const sent = transitions(page);
  await page.getByRole("button", { name: "Solicitar correção" }).click();
  const correction = page.getByRole("dialog", { name: "Solicitar correção" });
  await expect(
    correction.getByLabel("O que precisa ser corrigido"),
  ).toHaveAttribute("required", "");
  await checkLayout(page);
  // An empty message is blocked in the browser: nothing is sent.
  await correction.getByRole("button", { name: "Solicitar correção" }).click();
  await expect(correction).toBeVisible();
  expect(sent()).toBe(0);
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
  await checkLayout(page);
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
  const approve = page.getByRole("alertdialog", { name: "Aprovar documento?" });
  await expect(approve).toBeVisible();
  await checkLayout(page);
  await approve.getByRole("button", { name: "Aprovar documento" }).click();
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
  await checkLayout(page);
  const reopenSent = transitions(page);
  await reopen.getByRole("button", { name: "Reabrir documento" }).click();
  await expect(reopen).toBeVisible();
  expect(reopenSent()).toBe(0);
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
  playwright,
  baseURL,
}) => {
  // A document sent today must show up in the detailed report.
  const title = `PDF ${Date.now()}`;
  const team = await apiSignIn(
    playwright,
    baseURL!,
    auditAccounts.coordinatorA,
  );
  try {
    const response = await createDocument(
      team,
      { unitId: await teamId(team, auditTeams.a), title },
      pdfFile(),
    );
    expect(response.status()).toBe(201);
  } finally {
    await team.dispose();
  }

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

  const manausToday = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(
      new Date(),
    );
  for (const [label, name] of [
    ["Resumo em rascunho", "resumo-rascunho"],
    ["Relatório detalhado", "relatorio-detalhado"],
    ["Relatório analítico", "relatorio-analitico"],
  ] as const) {
    const day = manausToday();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: label }).click();
    const file = await download;
    expect([`${name}-${day}.pdf`, `${name}-${manausToday()}.pdf`]).toContain(
      file.suggestedFilename(),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of await file.createReadStream())
      chunks.push(chunk as Buffer);
    const pdf = Buffer.concat(chunks);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    if (name === "resumo-rascunho")
      expect(pdf.toString("latin1")).toContain("(RASCUNHO) Tj");
    if (name === "relatorio-detalhado")
      expect(pdf.toString("latin1")).toContain(`(${title}) Tj`);
  }
});

test("coordenação vê indicadores só da própria equipe", async ({ page }) => {
  await signIn(page, auditAccounts.coordinatorA);
  await page.goto("/controle-interno/documentos");
  await page.getByRole("link", { name: "Indicadores" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Indicadores de auditoria" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Equipe", exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([
    "Todas as equipes",
    auditTeams.a,
  ]);
  await page.keyboard.press("Escape");
  await checkLayout(page);
});

test("cancelamento pela interface exige motivo e encerra as ações", async ({
  page,
  playwright,
  baseURL,
}) => {
  const title = `Cancelamento UI ${Date.now()}`;
  const team = await apiSignIn(
    playwright,
    baseURL!,
    auditAccounts.coordinatorA,
  );
  const response = await createDocument(
    team,
    { unitId: await teamId(team, auditTeams.a), title },
    pdfFile(),
  );
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as Doc;
  await team.dispose();

  await signIn(page, auditAccounts.coordinatorA);
  await page.goto(`/controle-interno/documentos/${id}`);
  const sent = transitions(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  const cancel = page.getByRole("dialog", { name: "Cancelar documento" });
  await expect(cancel.getByLabel("Motivo")).toHaveAttribute("required", "");
  await checkLayout(page);
  await cancel.getByRole("button", { name: "Cancelar documento" }).click();
  await expect(cancel).toBeVisible();
  expect(sent()).toBe(0);
  // Only spaces pass the browser check but not the server.
  await cancel.getByLabel("Motivo").fill("   ");
  await cancel.getByRole("button", { name: "Cancelar documento" }).click();
  await expect(cancel.getByRole("alert")).toBeVisible();
  await expect(cancel).toBeVisible();
  await cancel.getByLabel("Motivo").fill("Enviado em duplicidade.");
  await cancel.getByRole("button", { name: "Cancelar documento" }).click();
  await expect(cancel).toBeHidden();
  await expect(
    page.locator("main").getByText("Cancelado", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Documento cancelado").first()).toBeVisible();
  await expect(page.getByText("Enviado em duplicidade.").first()).toBeVisible();
  await expectActions(page, []);

  await signIn(page, auditAccounts.reviewer);
  await page.goto(`/controle-interno/documentos/${id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await expectActions(page, []);
});

test("cada papel vê só as ações da etapa e escolhe a versão exibida", async ({
  page,
  playwright,
  baseURL,
}) => {
  const stamp = Date.now();
  const [team, reviewer] = await Promise.all([
    apiSignIn(playwright, baseURL!, auditAccounts.coordinatorA),
    apiSignIn(playwright, baseURL!, auditAccounts.reviewer),
  ]);
  try {
    const unit = await teamId(team, auditTeams.a);
    const create = async (title: string, text: string) => {
      const response = await createDocument(
        team,
        { unitId: unit, title },
        { name: "v1.docx", mimeType: docxMime, buffer: sampleDocx(text) },
      );
      expect(response.status()).toBe(201);
      return (await response.json()) as Doc;
    };
    const corrected = await create(
      `Ações em correção ${stamp}`,
      "Texto da versão um",
    );
    await act(
      reviewer,
      corrected,
      "request_correction",
      "Refazer a conclusão.",
    );
    const approved = await create(`Ações aprovado ${stamp}`, "Aprovado");
    await act(reviewer, approved, "approve");

    const open = async (doc: Doc) => {
      await page.goto(`/controle-interno/documentos/${doc.id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    };
    await signIn(page, auditAccounts.reviewer);
    await open(corrected);
    await expectActions(page, ["Cancelar"]);
    await open(approved);
    await expectActions(page, ["Reabrir"]);

    await signIn(page, auditAccounts.coordinatorA);
    await open(corrected);
    await expectActions(page, [
      "Editar no navegador",
      "Enviar nova versão",
      "Cancelar",
    ]);
    await open(approved);
    await expectActions(page, []);

    // Back in review with a second version: the selector shows either one.
    const response = await uploadVersion(
      team,
      corrected.id,
      { version: corrected.version },
      {
        name: "v2.docx",
        mimeType: docxMime,
        buffer: sampleDocx("Texto da versão dois"),
      },
    );
    expect(response.status()).toBe(201);
    await open(corrected);
    await expectActions(page, ["Cancelar"]);
    await expect(
      page
        .frameLocator('iframe[title="Visualização da versão 2"]')
        .getByText("Texto da versão dois"),
    ).toBeVisible();
    await chooseOption(page, "Versão", "Versão 1");
    await expect(
      page
        .frameLocator('iframe[title="Visualização da versão 1"]')
        .getByText("Texto da versão um"),
    ).toBeVisible();
  } finally {
    await Promise.all([team.dispose(), reviewer.dispose()]);
  }
});

test("envio recusa PDF sem texto e .doc dentro do diálogo", async ({
  page,
}) => {
  const title = `Envio recusado ${Date.now()}`;
  await signIn(page, auditAccounts.coordinatorA);
  await page.goto("/controle-interno/documentos");
  await page.getByRole("button", { name: "Enviar documento" }).first().click();
  const upload = page.getByRole("dialog", { name: "Enviar documento" });
  await chooseOption(upload, "Equipe", auditTeams.a);
  await upload.getByLabel("Título").fill(title);

  await upload.getByLabel("Arquivo").setInputFiles({
    name: "digitalizado.pdf",
    mimeType: "application/pdf",
    buffer: blankPdf,
  });
  await upload.getByRole("button", { name: "Enviar documento" }).click();
  await expect(upload.getByRole("alert")).toContainText("OCR");
  await expect(upload).toBeVisible();
  await checkLayout(page);

  await upload.getByLabel("Arquivo").setInputFiles({
    name: "planilha.doc",
    mimeType: "application/msword",
    buffer: Buffer.from("texto simples, não é documento"),
  });
  await upload.getByRole("button", { name: "Enviar documento" }).click();
  await expect(upload.getByRole("alert")).toContainText(".docx");
  await expect(upload).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByLabel("Buscar documentos").fill(title);
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0);
});

test("pendência de correção abre o documento", async ({
  page,
  playwright,
  baseURL,
}) => {
  const stamp = Date.now();
  const title = `Pendência UI ${stamp}`;
  const clients = await Promise.all(
    [
      auditAccounts.admin,
      auditAccounts.coordinatorA,
      auditAccounts.reviewer,
    ].map((email) => apiSignIn(playwright, baseURL!, email)),
  );
  const [admin, team, reviewer] = clients as [
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
  ];
  let grantId = "";
  try {
    // Dedicated unit, so the inbox filter shows only this document.
    const unitName = `Equipe Pendência UI ${stamp}`;
    const unit = await admin.post("/api/organization-units", {
      data: { code: `AUD-P-${stamp}`, name: unitName },
    });
    expect(unit.status()).toBe(201);
    const unitId = ((await unit.json()) as { id: string }).id;
    const me = await (await team.get("/api/auth/me")).json();
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: me.user.account.id,
        permission: "audit_documents.submit",
        effect: "allow",
        unitId,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = ((await grant.json()) as { id: string }).id;
    const created = await createDocument(team, { unitId, title }, pdfFile());
    expect(created.status()).toBe(201);
    const doc = (await created.json()) as Doc;
    await act(reviewer, doc, "request_correction", "Anexar evidências.");

    await signIn(page, auditAccounts.coordinatorA);
    await page.goto("/rh/pendencias");
    await page
      .getByLabel("Tipo de pendência")
      .selectOption({ label: "Documentos de auditoria" });
    await page
      .getByLabel("Unidade da pendência")
      .selectOption({ label: unitName });
    await page
      .getByRole("link", { name: new RegExp(`^Abrir: .* — ${title}$`) })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/controle-interno/documentos/${doc.id}$`),
    );
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await act(team, doc, "cancel", "Encerrado pelo teste.");
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await Promise.all(clients.map((client) => client.dispose()));
  }
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
