import { Alert, Button, Skeleton } from "@cge/ui";
import { useEffect, useRef, useState } from "react";

// Frame styles for the DOCX preview. Runs inside a sandboxed iframe with no
// scripts, so the document's own markup cannot touch the intranet page.
// The frame cannot see the page's CSS variables, so the token is copied in.
const frameStyles = (background: string) => `
  html, body { margin: 0; background: ${background}; }
  .docx-wrapper { background: transparent !important; padding: 16px !important; }
  .docx-wrapper > section.docx { box-shadow: none !important; margin: 0 auto 16px !important; max-width: 100%; }
  img { max-width: 100%; height: auto; }
`;

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
      const [data, { renderAsync }] = await Promise.all([
        response.arrayBuffer(),
        import("docx-preview"),
      ]);
      const doc = frame.current?.contentDocument;
      if (!doc || controller.signal.aborted) return;
      doc.open();
      doc.write(
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${frameStyles(getComputedStyle(document.documentElement).getPropertyValue("--surface-subtle"))}</style></head><body></body></html>`,
      );
      doc.close();
      await renderAsync(data, doc.body, doc.head, {
        ignoreLastRenderedPageBreak: true,
        useBase64URL: true,
      });
      if (!controller.signal.aborted) setState("ready");
    })().catch(() => {
      if (!controller.signal.aborted) setState("error");
    });
    return () => controller.abort();
  }, [url, attempt]);

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
            : "h-[70vh] min-h-96 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)]"
        }
        ref={frame}
        sandbox="allow-same-origin"
        title={title}
      />
    </div>
  );
}
