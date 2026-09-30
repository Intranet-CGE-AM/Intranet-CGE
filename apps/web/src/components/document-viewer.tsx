import { Alert, Button, Skeleton } from "@cge/ui";
import { useEffect, useRef, useState } from "react";

// Office fonts most machines lack, mapped to what they do have (metric
// compatible first). Without this a missing "Calibri" falls back to the
// browser default serif. Goes before the document's own @font-face rules so
// fonts embedded in the file still win.
const fontAliases = {
  Calibri: ["Calibri", "Carlito", "Arial", "Liberation Sans", "Helvetica"],
  "Calibri Light": ["Calibri Light", "Carlito", "Arial", "Helvetica"],
  Aptos: ["Aptos", "Arial", "Liberation Sans", "Helvetica"],
  Cambria: ["Cambria", "Caladea", "Georgia", "Times New Roman"],
  Arial: ["Arial", "ArialMT", "Liberation Sans", "Helvetica"],
  "Times New Roman": ["Times New Roman", "Liberation Serif", "Times"],
};
const fontFaces = Object.entries(fontAliases)
  .flatMap(([family, locals]) =>
    [false, true].map(
      (bold) =>
        `@font-face { font-family: "${family}"; font-weight: ${bold ? 700 : 400}; src: ${locals
          .map((name) => `local("${name}${bold ? " Bold" : ""}")`)
          .join(", ")}; }`,
    ),
  )
  .join("\n");

const sans = '"Calibri", "Carlito", Arial, Helvetica, sans-serif';

// Word's built-in styles (Office 2013+ look), used only for style ids the
// file does not define itself. docx-preview names classes docx_<id>.
const builtInStyles: Record<string, string> = {
  title: `font-family: "Calibri Light", ${sans}; font-size: 28pt; letter-spacing: -0.5pt; margin-bottom: 0;`,
  subtitle: "font-size: 11pt; color: #5a5a5a; letter-spacing: 0.75pt;",
  heading1: `font-family: "Calibri Light", ${sans}; font-size: 16pt; color: #2f5496; margin: 12pt 0 0;`,
  heading2: `font-family: "Calibri Light", ${sans}; font-size: 13pt; color: #2f5496; margin: 2pt 0 0;`,
  heading3: `font-family: "Calibri Light", ${sans}; font-size: 12pt; color: #1f3763; margin: 2pt 0 0;`,
  heading4: "font-style: italic; color: #2f5496; margin: 2pt 0 0;",
  heading5: "color: #2f5496; margin: 2pt 0 0;",
  heading6: "color: #1f3763; margin: 2pt 0 0;",
  listparagraph: "margin-left: 36pt;",
  quote:
    "font-style: italic; color: #404040; text-align: center; margin: 10pt 43.2pt;",
  hyperlink: "color: #0563c1; text-decoration: underline;",
};

// Minimal shape of docx-preview's parsed document (typed as any upstream).
type WordStyle = {
  id: string | null;
  isDefault?: boolean;
  styles?: { values: Record<string, string> }[];
};
type WordElement = {
  type?: string;
  styleName?: string;
  className?: string;
  cssStyle?: Record<string, string>;
  cellStyle?: Record<string, string>;
  children?: WordElement[];
};
type WordDocument = {
  documentPart: {
    body: WordElement & { props?: Record<string, unknown> };
  };
  stylesPart?: { styles: WordStyle[] };
};

const hasBorder = (style?: Record<string, string>) =>
  Object.keys(style ?? {}).some((key) => key.startsWith("border"));

/**
 * Fills what the file leaves out, so any valid .docx reads like a page:
 * A4 portrait with 2.5 cm margins when there is no page size, Word's look
 * for built-in styles the file does not define, and light gridlines on
 * tables with no border or table style at all. Word draws those tables
 * borderless, but a table with no border info at all comes from other
 * tools, not from a person who removed the borders (Word writes those as
 * explicit "none" borders, which keep the table borderless here too).
 * Returns the CSS that goes with it.
 */
function fillDefaults(document: WordDocument) {
  const body = document.documentPart.body;
  const props = (body.props ??= {});
  props.pageSize ??= { width: "595.3pt", height: "841.9pt" };
  props.pageMargins ??= {
    top: "70.85pt",
    right: "70.85pt",
    bottom: "70.85pt",
    left: "70.85pt",
    header: "35.4pt",
    footer: "35.4pt",
  };

  const tables = (element: WordElement) => {
    if (element.type === "table") {
      const bordered =
        element.styleName ||
        hasBorder(element.cssStyle) ||
        hasBorder(element.cellStyle) ||
        element.children?.some((row) =>
          row.children?.some((cell) => hasBorder(cell.cssStyle)),
        );
      if (!bordered)
        element.className = `${element.className ?? ""} docx-gridlines`;
    }
    element.children?.forEach(tables);
  };
  tables(body);

  const styles = document.stylesPart?.styles ?? [];
  const formatted = (style: WordStyle) =>
    style.styles?.some((part) => Object.keys(part.values).length > 0);
  const own = new Set(
    styles.filter(formatted).map((style) => style.id?.toLowerCase()),
  );
  const rules = Object.entries(builtInStyles)
    .filter(([id]) => !own.has(id))
    .map(([id, css]) => `.docx .docx_${id} { ${css} }`);
  if (!own.has("tablegrid"))
    rules.push(".docx table.docx_tablegrid td { border: 0.5pt solid #000; }");
  // No document defaults at all: Word's Normal style. Otherwise the default
  // run font still goes on the page, for text docx-preview draws outside a
  // run (list numbers).
  if (
    !styles.some((style) => (!style.id || style.isDefault) && formatted(style))
  )
    rules.push(
      `.docx { font-family: ${sans}; font-size: 11pt; line-height: 1.15; }`,
      ".docx p { margin-bottom: 8pt; }",
    );
  else
    rules.push(
      `.docx { font-family: ${styles.find((style) => !style.id)?.styles?.find((part) => part.values["font-family"])?.values["font-family"] ?? sans}; }`,
    );
  return rules.join("\n");
}

// Frame styles. The frame runs sandboxed with no scripts, so the file's
// markup cannot touch the intranet page, and it cannot see the page's CSS
// variables, so the canvas color is copied in. Pages are scaled with zoom
// (--page-zoom, set by fit()); below READABLE_ZOOM the text reflows at the
// frame width instead of shrinking past reading size.
const frameStyles = (canvas: string) => `
  html, body { margin: 0; background: ${canvas}; }
  .docx-wrapper { background: transparent; padding: 16px; }
  .docx-wrapper > section.docx {
    zoom: var(--page-zoom, 1);
    margin: 0 0 16px;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 16px rgb(0 0 0 / 0.08);
  }
  .docx a { color: #0563c1; text-decoration: underline; }
  .docx img, .docx div:has(> img) { max-width: 100%; height: auto !important; }
  .docx td { padding-left: 5.4pt; padding-right: 5.4pt; }
  .docx table.docx-gridlines td { border: 1px solid #bfbfbf; }
  html.reflow .docx-wrapper { padding: 8px; }
  html.reflow .docx-wrapper > section.docx {
    width: auto !important;
    align-self: stretch;
    min-height: 0 !important;
    padding: 24px 20px !important;
  }
  /* Headers and footers sit in the page margins; reflow drops the margins. */
  html.reflow section.docx > :is(header, footer) {
    margin: 0 !important;
    min-height: 0 !important;
  }
  html.reflow section.docx > header { margin-bottom: 16px !important; }
  html.reflow section.docx > footer { margin-top: 16px !important; }
`;

const READABLE_ZOOM = 0.6;

export function DocumentViewer({
  kind,
  title,
  url,
}: {
  kind: "docx" | "pdf";
  title: string;
  url: string;
}) {
  return kind === "pdf" ? (
    <iframe
      className="h-[70vh] min-h-96 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)]"
      src={url}
      title={title}
    />
  ) : (
    <DocxViewer title={title} url={url} />
  );
}

function DocxViewer({ title, url }: { title: string; url: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    (async () => {
      const response = await fetch(url, {
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const [data, { parseAsync, renderDocument }] = await Promise.all([
        response.arrayBuffer(),
        import("docx-preview"),
      ]);
      const doc = frame.current?.contentDocument;
      if (!doc || controller.signal.aborted) return;
      const options = {
        ignoreLastRenderedPageBreak: true,
        useBase64URL: true,
      };
      const parsed = (await parseAsync(data, options)) as WordDocument;
      const fallback = fillDefaults(parsed);
      const nodes = await renderDocument(parsed, options);
      doc.open();
      doc.write(
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body></body></html>',
      );
      doc.close();
      const style = (text: string) => {
        const element = doc.createElement("style");
        element.textContent = text;
        return element;
      };
      doc.head.append(style(fontFaces));
      for (const node of nodes)
        (node.nodeName === "STYLE" ? doc.head : doc.body).append(node);
      // After docx-preview's own rules, so these win at equal specificity.
      doc.head.append(
        style(
          fallback +
            frameStyles(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--surface-subtle",
              ),
            ),
        ),
      );
      if (!controller.signal.aborted) setState("ready");
    })().catch(() => {
      if (!controller.signal.aborted) setState("error");
    });
    return () => controller.abort();
  }, [url, attempt]);

  // Scales the pages to the frame width and sizes the frame to its content
  // (capped by max-height, then it scrolls). Reruns when the card resizes
  // or the content grows (late images and fonts).
  useEffect(() => {
    const element = frame.current;
    const doc = element?.contentDocument;
    if (state !== "ready" || !element || !doc) return;
    const root = doc.documentElement;
    const fit = () => {
      root.classList.remove("reflow");
      root.style.setProperty("--page-zoom", "1");
      const widest = Math.max(
        1,
        ...[...doc.querySelectorAll<HTMLElement>("section.docx")].map(
          (page) => page.offsetWidth,
        ),
      );
      // 32px: the canvas padding around the pages.
      const zoom = Math.min(1, (root.clientWidth - 32) / widest);
      if (zoom < READABLE_ZOOM) root.classList.add("reflow");
      else root.style.setProperty("--page-zoom", String(zoom));
      element.style.height = `${Math.ceil(doc.body.getBoundingClientRect().height)}px`;
    };
    // Next frame: resizing the frame inside the callback would loop.
    const observer = new ResizeObserver(() => requestAnimationFrame(fit));
    observer.observe(element);
    observer.observe(doc.body);
    return () => observer.disconnect();
  }, [state]);

  return (
    <div className="relative">
      {state === "loading" ? (
        <div
          aria-label="Carregando visualização"
          className="absolute inset-0 space-y-3 p-4"
          role="status"
        >
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {state === "error" ? (
        <Alert title="Não foi possível abrir a visualização" tone="danger">
          <p>Baixe o arquivo para ler no editor de texto ou tente de novo.</p>
          <Button
            className="mt-3"
            onClick={() => setAttempt((value) => value + 1)}
            size="sm"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : null}
      <iframe
        className={
          state === "error"
            ? "hidden"
            : `${state === "ready" ? "max-h-[80vh]" : "h-96"} block w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)]`
        }
        ref={frame}
        sandbox="allow-same-origin"
        title={title}
      />
    </div>
  );
}
