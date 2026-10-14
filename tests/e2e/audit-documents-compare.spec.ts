import type { APIRequestContext } from "@playwright/test";

import { detail, transition, unique } from "./audit-document-api";
import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxMime,
  pdfFile,
  signIn,
  unitId,
  uploadVersion,
  zip,
} from "./audit-document-fixtures";
import { signInPage } from "./audit-ui-fixtures";
import { expect, test, type Page } from "./fixtures";

test.use({ actionTimeout: 15_000 });

type File = { name: string; mimeType: string; buffer: Buffer };

const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Minimal Word file with one paragraph per string. */
function docxOf(paragraphs: string[]): File {
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const r =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t>${xml(text)}</w:t></w:r></w:p>`)
    .join("");
  return {
    name: "relatorio.docx",
    mimeType: docxMime,
    buffer: zip({
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${r}/officeDocument" Target="word/document.xml"/></Relationships>`,
      "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${w}"><w:body>${body}</w:body></w:document>`,
    }),
  };
}

// Twelve unchanged lines sit between the removed paragraph and the changed one.
const filler = Array.from({ length: 12 }, (_, i) => `Linha comum ${i + 1}`);
const v1 = [
  "Introdução do relatório",
  "Escopo da auditoria",
  ...filler,
  "Achado sobre licitação com risco alto",
  "Conclusão geral",
];
// Removed "Escopo da auditoria", one word changed (alto -> médio), one added.
const v2 = [
  "Introdução do relatório",
  ...filler,
  "Achado sobre licitação com risco médio",
  "Conclusão geral",
  "Recomendação nova ao gestor",
];

type Doc = {
  id: string;
  version: number;
  files: { id: string; number: number }[];
};

/** Team sends `first`; the reviewer asks for a fix; the team sends each next file. */
async function setup(
  playwright: Parameters<typeof signIn>[0],
  baseURL: string,
  files: File[],
) {
  const team = await signIn(playwright, baseURL, auditAccounts.coordinatorA);
  const reviewer = await signIn(playwright, baseURL, auditAccounts.reviewer);
  const created = await createDocument(
    team,
    {
      unitId: await unitId(team, auditTeams.a),
      title: unique("Comparação"),
    },
    files[0]!,
  );
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  for (const file of files.slice(1)) await addVersion(team, reviewer, id, file);
  const doc = (await detail(team, id)) as unknown as Doc;
  await Promise.all([team.dispose(), reviewer.dispose()]);
  return doc;
}

async function addVersion(
  team: APIRequestContext,
  reviewer: APIRequestContext,
  id: string,
  file: File,
) {
  const asked = await transition(reviewer, id, {
    action: "request_correction",
    version: (await detail(reviewer, id)).version,
    message: "Ajustar",
  });
  expect(asked.status()).toBe(200);
  const sent = await uploadVersion(
    team,
    id,
    { version: (await detail(team, id)).version },
    file,
  );
  expect(sent.status()).toBe(201);
}

const widths = [375, 1024, 1440];
const table = (page: Page) => page.getByRole("table", { name: "Diferenças" });

for (const width of widths) {
  test(`Comparar no cartão Arquivo abre v1 e v2 com os contadores (${width}px)`, async ({
    page,
    playwright,
    baseURL,
  }) => {
    const doc = await setup(playwright, baseURL!, [docxOf(v1), docxOf(v2)]);
    await page.setViewportSize({ width, height: 844 });
    await signInPage(page, auditAccounts.reviewer);
    await page.goto(`/controle-interno/documentos/${doc.id}`);
    await page.getByRole("link", { name: "Comparar", exact: true }).click();
    await expect(page).toHaveURL(/\/comparar\?de=.+&para=.+/);
    await expect(page.getByText("+2")).toBeVisible();
    await expect(page.getByText("−2")).toBeVisible();
    await expect(
      table(page).getByText("Recomendação nova ao gestor"),
    ).toBeVisible();
    await expect(table(page).getByText("Escopo da auditoria")).toBeVisible();
  });
}

test("Comparar com anterior na tabela abre o par certo e some na versão 1", async ({
  page,
  playwright,
  baseURL,
}) => {
  const doc = await setup(playwright, baseURL!, [
    docxOf(v1),
    docxOf(v2),
    docxOf([...v2, "Terceira versão"]),
  ]);
  const id = (number: number) =>
    doc.files.find((file) => file.number === number)!.id;
  await signInPage(page, auditAccounts.reviewer);
  await page.goto(`/controle-interno/documentos/${doc.id}`);
  const row = (number: number) =>
    page.getByRole("row", { name: new RegExp(`^Versão ${number}\\b`) });

  await expect(
    row(1).getByRole("link", { name: "Comparar com anterior" }),
  ).toHaveCount(0);
  await row(2).getByRole("link", { name: "Comparar com anterior" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/comparar\\?de=${id(1)}&para=${id(2)}$`),
  );
  await expect(page.getByRole("combobox", { name: "Versão base" })).toHaveText(
    "Versão 1",
  );
  await expect(
    page.getByRole("combobox", { name: "Versão comparada" }),
  ).toHaveText("Versão 2");
});

for (const width of widths) {
  test(`Alterna Unificado e Lado a lado; abaixo de 768px só Unificado (${width}px)`, async ({
    page,
    playwright,
    baseURL,
  }) => {
    const doc = await setup(playwright, baseURL!, [docxOf(v1), docxOf(v2)]);
    await page.setViewportSize({ width, height: 844 });
    await signInPage(page, auditAccounts.reviewer);
    await page.goto(`/controle-interno/documentos/${doc.id}`);
    await page.getByRole("link", { name: "Comparar", exact: true }).click();
    const unified = page.getByRole("columnheader", { name: "Alteração" });
    const split = page.getByRole("columnheader", { name: "Texto da base" });
    const toUnified = page.getByRole("button", { name: "Unificado" });
    const toSplit = page.getByRole("button", { name: "Lado a lado" });
    await expect(unified).toBeAttached();

    if (width < 768) {
      await expect(toUnified).toHaveCount(0);
      await expect(toSplit).toHaveCount(0);
      // A saved "split" choice must not leak into the phone layout.
      await page.evaluate(() =>
        window.localStorage.setItem("audit-compare:mode", "split"),
      );
      await page.reload();
      await expect(unified).toBeAttached();
      await expect(split).toHaveCount(0);
      return;
    }
    await toSplit.click();
    await expect(split).toBeAttached();
    await expect(unified).toHaveCount(0);
    await page.reload();
    await expect(split).toBeAttached(); // remembered
    await toUnified.click();
    await expect(unified).toBeAttached();
    await expect(split).toHaveCount(0);
  });
}

test("Trecho igual recolhido abre ao clicar", async ({
  page,
  playwright,
  baseURL,
}) => {
  const doc = await setup(playwright, baseURL!, [docxOf(v1), docxOf(v2)]);
  await signInPage(page, auditAccounts.reviewer);
  await page.goto(`/controle-interno/documentos/${doc.id}`);
  await page.getByRole("link", { name: "Comparar", exact: true }).click();
  const hiddenLine = table(page).getByText("Linha comum 6", { exact: true });
  await expect(
    table(page).getByText("Linha comum 3", { exact: true }),
  ).toBeVisible();
  await expect(hiddenLine).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar 6 linhas iguais" }).click();
  await expect(hiddenLine).toBeVisible();
  await expect(page.getByRole("button", { name: /linhas iguais/ })).toHaveCount(
    0,
  );
});

test("Versão em PDF: Comparar desabilitado e link direto explica", async ({
  page,
  playwright,
  baseURL,
}) => {
  const doc = await setup(playwright, baseURL!, [docxOf(v1), pdfFile()]);
  const id = (number: number) =>
    doc.files.find((file) => file.number === number)!.id;
  await signInPage(page, auditAccounts.reviewer);
  await page.goto(`/controle-interno/documentos/${doc.id}`);
  await expect(
    page.getByRole("button", { name: "Comparar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Comparar", exact: true }),
  ).toHaveCount(0);

  await page.goto(
    `/controle-interno/documentos/${doc.id}/comparar?de=${id(1)}&para=${id(2)}`,
  );
  await expect(
    page.getByText("Comparação disponível só para arquivos Word"),
  ).toBeVisible();
  await expect(table(page)).toHaveCount(0);
});

test("de inválido mostra o erro com o atalho para a versão anterior", async ({
  page,
  playwright,
  baseURL,
}) => {
  const doc = await setup(playwright, baseURL!, [docxOf(v1), docxOf(v2)]);
  const v2Id = doc.files.find((file) => file.number === 2)!.id;
  await signInPage(page, auditAccounts.reviewer);
  await page.goto(
    `/controle-interno/documentos/${doc.id}/comparar?de=nao-existe&para=${v2Id}`,
  );
  await expect(page.getByText("Versões inválidas")).toBeVisible();
  await page
    .getByRole("link", { name: "Comparar a versão 2 com a anterior" })
    .click();
  await expect(
    table(page).getByText("Recomendação nova ao gestor"),
  ).toBeVisible();
});

test("Abrir a comparação não marca as versões como lidas", async ({
  page,
  playwright,
  baseURL,
}) => {
  const doc = await setup(playwright, baseURL!, [docxOf(v1), docxOf(v2)]);
  const [base, next] = [1, 2].map(
    (number) => doc.files.find((file) => file.number === number)!.id,
  );
  await signInPage(page, auditAccounts.reviewer);
  // Straight to the compare URL: the detail page would record a read itself.
  await page.goto(
    `/controle-interno/documentos/${doc.id}/comparar?de=${base}&para=${next}`,
  );
  await expect(
    table(page).getByText("Recomendação nova ao gestor"),
  ).toBeVisible();

  const reviewer = await signIn(playwright, baseURL!, auditAccounts.reviewer);
  const events = (await detail(reviewer, doc.id)).events;
  await reviewer.dispose();
  expect(events.filter((event) => event.type === "read")).toEqual([]);
});
