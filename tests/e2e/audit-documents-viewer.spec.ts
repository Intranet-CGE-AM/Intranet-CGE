import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxMime,
  signIn,
  unitId,
} from "./audit-document-fixtures";
import { richDocx, signInPage } from "./audit-ui-fixtures";
import { institutionalDocx } from "./audit-viewer-fixtures";
import { expect, test, type Page } from "./fixtures";

test.use({ actionTimeout: 15_000 });

// A4 at 96 dpi: 210 x 297 mm.
const A4_WIDTH = 794;
const A4_RATIO = 297 / 210;

async function openUpload(
  page: Page,
  playwright: Parameters<typeof signIn>[0],
  baseURL: string,
  name: string,
  buffer: Buffer,
) {
  const team = await signIn(playwright, baseURL, auditAccounts.coordinatorA);
  const response = await createDocument(
    team,
    {
      unitId: await unitId(team, auditTeams.a),
      title: `Visualizador ${name} ${Date.now()}`,
    },
    { name: `${name}.docx`, mimeType: docxMime, buffer },
  );
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  await team.dispose();
  await signInPage(page, auditAccounts.reviewer);
  await page.goto(`/controle-interno/documentos/${id}`);
  const frame = page.locator('iframe[title="Visualização da versão 1"]');
  await expect(frame.contentFrame().locator("section.docx")).toBeVisible();
  return frame;
}

test("Word sem estilos nem tamanho de página abre como página A4", async ({
  page,
  playwright,
  baseURL,
}) => {
  // No word/styles.xml, no w:sectPr: what other tools often write.
  const frame = await openUpload(
    page,
    playwright,
    baseURL!,
    "sem-estilos",
    richDocx({ styles: false }),
  );

  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const measure = () =>
      frame.evaluate((element: HTMLIFrameElement) => {
        const doc = element.contentDocument!;
        const page = doc.querySelector("section.docx")!.getBoundingClientRect();
        return {
          frameWidth: doc.documentElement.clientWidth,
          frameHeight: element.getBoundingClientRect().height,
          contentHeight: doc.body.getBoundingClientRect().height,
          frameScrolls:
            doc.documentElement.scrollWidth > doc.documentElement.clientWidth,
          pageScrolls: document.documentElement.scrollWidth > innerWidth,
          pageWidth: page.width,
          ratio: page.height / page.width,
        };
      });
    // Fitting runs on resize, so the checks retry until it settles.
    await expect(async () => {
      const box = await measure();
      expect(box.pageScrolls, `page scroll at ${width}px`).toBe(false);
      expect(box.frameScrolls, `frame scroll at ${width}px`).toBe(false);
      // The frame follows the content instead of a fixed, mostly empty box.
      expect(box.frameHeight, `frame height at ${width}px`).toBeLessThanOrEqual(
        Math.min(box.contentHeight + 2, 844 * 0.8 + 1),
      );
      if (width === 375) {
        // Too narrow for a readable A4: the text reflows at the frame width.
        expect(box.pageWidth).toBeGreaterThan(0.9 * (box.frameWidth - 16));
      } else {
        // An A4 sheet, scaled to the card, at a readable size.
        expect(box.pageWidth).toBeGreaterThan(0.75 * A4_WIDTH);
        expect(box.pageWidth).toBeLessThanOrEqual(box.frameWidth);
        expect(box.ratio).toBeCloseTo(A4_RATIO, 1);
      }
    }, `viewer at ${width}px`).toPass({ timeout: 10_000 });
  }
});

test("Word sem estilos mostra títulos, tabela e links como no Word", async ({
  page,
  playwright,
  baseURL,
}) => {
  const view = (
    await openUpload(
      page,
      playwright,
      baseURL!,
      "sem-estilos",
      richDocx({ styles: false }),
    )
  ).contentFrame();

  const fontSize = (text: string) =>
    view
      .getByText(text, { exact: true })
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(await fontSize("Relatório de auditoria")).toBeGreaterThan(
    (await fontSize("Texto justificado")) * 1.3,
  );
  expect(await fontSize("Detalhe do achado")).toBeGreaterThan(
    await fontSize("Texto justificado"),
  );

  // Bare table: light gridlines instead of no borders at all.
  const border = await view
    .getByRole("cell", { name: "Achado" })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        style: style.borderTopStyle,
        width: parseFloat(style.borderLeftWidth),
      };
    });
  expect(border.style).toBe("solid");
  expect(border.width).toBeGreaterThan(0);

  const link = view.getByText("portal", { exact: true });
  expect(
    await link.evaluate(
      (element) => getComputedStyle(element.closest("a")!).textDecorationLine,
    ),
  ).toBe("underline");
});

test("estilos do próprio Word não são trocados pelos padrões", async ({
  page,
  playwright,
  baseURL,
}) => {
  const frame = await openUpload(
    page,
    playwright,
    baseURL!,
    "institucional",
    await institutionalDocx(),
  );
  const heading = frame.contentFrame().getByText("1. Objeto", { exact: true });
  const style = await heading.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.color, family: computed.fontFamily };
  });
  expect(style.color).toBe("rgb(11, 61, 110)");
  expect(style.family).toContain("Georgia");
  // The letterhead image stays inside the page.
  const fits = await frame.evaluate((element: HTMLIFrameElement) => {
    const doc = element.contentDocument!;
    const page = doc.querySelector("section.docx")!.getBoundingClientRect();
    const image = doc.querySelector("header img")!.getBoundingClientRect();
    return image.right <= page.right + 1 && image.width > 0;
  });
  expect(fits).toBe(true);
});
