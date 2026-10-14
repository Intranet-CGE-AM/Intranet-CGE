import type { AuditDocumentDetail } from "@cge/contracts";
import { Alert, Button, Card, Skeleton } from "@cge/ui";
import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { FieldSelect } from "../components/field-select";
import { PageHeader } from "../components/page-header";
import { api } from "../lib/api";
import {
  collapse,
  countChanges,
  diffLines,
  docxToLines,
  type CollapsedItem,
  type DiffRow,
  type Segment,
} from "../lib/docx-diff";
import {
  AUDIT_EYEBROW,
  compareUrl,
  errorMessage,
  fileUrl,
} from "./audit-documents";

type Mode = "unified" | "split";
const MODE_KEY = "audit-compare:mode";

function storedMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === "split"
      ? "split"
      : "unified";
  } catch {
    return "unified";
  }
}

function useWide() {
  const query = "(min-width: 768px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return wide;
}

async function fetchLines(documentId: string, fileId: string) {
  // track=false: comparing is not reading, so no `read` event.
  const response = await fetch(fileUrl(documentId, fileId, "inline", false), {
    credentials: "include",
  });
  if (!response.ok) throw new Error("download");
  return docxToLines(await response.arrayBuffer());
}

export function AuditDocumentComparePage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const de = params.get("de") ?? "";
  const para = params.get("para") ?? "";
  const [document, setDocument] = useState<AuditDocumentDetail | null>(null);
  const [rows, setRows] = useState<DiffRow[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<Mode>(storedMode);
  const wide = useWide();

  const base = document?.files.find((file) => file.id === de);
  const next = document?.files.find((file) => file.id === para);
  const valid = Boolean(base && next && base.id !== next.id);
  const wordOnly = valid && (base!.kind !== "docx" || next!.kind !== "docx");

  useEffect(() => {
    let active = true;
    setDocument(null);
    setError("");
    api<AuditDocumentDetail>(`/api/audit-documents/${id}`)
      .then((loaded) => active && setDocument(loaded))
      .catch(
        (cause: unknown) =>
          active &&
          setError(
            errorMessage(cause, "Não foi possível carregar o documento."),
          ),
      );
    return () => {
      active = false;
    };
  }, [id, attempt]);

  useEffect(() => {
    setRows(null);
    if (!document || !valid || wordOnly) return;
    let active = true;
    setError("");
    Promise.all([fetchLines(id, de), fetchLines(id, para)])
      .then(([left, right]) => active && setRows(diffLines(left, right)))
      .catch(
        () =>
          active &&
          setError("Não foi possível abrir os arquivos para comparar."),
      );
    return () => {
      active = false;
    };
  }, [document, valid, wordOnly, id, de, para, attempt]);

  function chooseMode(value: Mode) {
    setMode(value);
    try {
      window.localStorage.setItem(MODE_KEY, value);
    } catch {
      // Not remembered; the toggle still works for this visit.
    }
  }

  const back = (
    <Button asChild className="-ml-2" size="sm" variant="quiet">
      <Link to={`/controle-interno/documentos/${id}`}>
        <ArrowLeft aria-hidden="true" size={16} />
        Voltar ao documento
      </Link>
    </Button>
  );
  const retry = (
    <Button
      className="mt-3"
      onClick={() => setAttempt((count) => count + 1)}
      size="sm"
      variant="secondary"
    >
      Tentar de novo
    </Button>
  );

  if (!document)
    return (
      <div className="page-enter space-y-4">
        {back}
        {error ? (
          <Alert title="Comparação indisponível" tone="danger">
            <p>{error}</p>
            {retry}
          </Alert>
        ) : (
          <Loading />
        )}
      </div>
    );

  const files = [...document.files].sort((a, b) => b.number - a.number);
  const [latest, previous] = files;
  const options = files.map((file) => ({
    label: `Versão ${file.number}`,
    value: file.id,
  }));
  const pick = (key: "de" | "para") => (value: string) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        copy.set(key, value);
        return copy;
      },
      { replace: true },
    );
  const counts = rows ? countChanges(rows) : null;
  const effective: Mode = wide ? mode : "unified";

  let body: ReactNode;
  if (!valid)
    body = (
      <Alert title="Versões inválidas" tone="warning">
        <p>
          As versões do endereço não existem neste documento ou são a mesma.
        </p>
        {latest && previous ? (
          <Button asChild className="mt-3" size="sm" variant="secondary">
            <Link to={compareUrl(id, previous, latest)}>
              Comparar a versão {latest.number} com a anterior
            </Link>
          </Button>
        ) : null}
      </Alert>
    );
  else if (wordOnly)
    body = (
      <Alert title="Comparação disponível só para arquivos Word" tone="warning">
        <p>Uma das versões escolhidas é PDF e não pode ser comparada.</p>
      </Alert>
    );
  else if (error)
    body = (
      <Alert title="Não foi possível comparar" tone="danger">
        <p>{error}</p>
        {retry}
      </Alert>
    );
  else if (!rows) body = <Loading />;
  else if (counts!.added === 0 && counts!.removed === 0)
    body = (
      <Alert title="Sem diferenças" tone="neutral">
        <p>Nenhuma diferença de texto entre as versões.</p>
      </Alert>
    );
  else body = <DiffTable mode={effective} rows={rows} />;

  return (
    <div className="page-enter space-y-4">
      {back}
      <PageHeader
        description={document.title}
        eyebrow={AUDIT_EYEBROW}
        title="Comparar versões"
      />
      <div className="flex flex-wrap items-end gap-3">
        <FieldSelect
          aria-label="Versão base"
          className="min-h-9 w-40"
          id="compareBase"
          name="compareBase"
          onValueChange={pick("de")}
          options={options}
          value={base?.id ?? ""}
        />
        <span aria-hidden="true" className="pb-2 text-[var(--text-faint)]">
          →
        </span>
        <FieldSelect
          aria-label="Versão comparada"
          className="min-h-9 w-40"
          id="compareNext"
          name="compareNext"
          onValueChange={pick("para")}
          options={options}
          value={next?.id ?? ""}
        />
        {counts ? (
          <p className="pb-2 text-sm font-semibold">
            <span className="text-[var(--success)]">+{counts.added}</span>{" "}
            <span className="text-[var(--danger)]">−{counts.removed}</span>
          </p>
        ) : null}
        {wide && rows ? (
          <div
            aria-label="Modo de exibição"
            className="ml-auto flex gap-1"
            role="group"
          >
            {(
              [
                ["unified", "Unificado"],
                ["split", "Lado a lado"],
              ] as const
            ).map(([value, label]) => (
              <Button
                aria-pressed={mode === value}
                key={value}
                onClick={() => chooseMode(value)}
                size="sm"
                variant={mode === value ? "primary" : "secondary"}
              >
                {label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {body}
    </div>
  );
}

function Loading() {
  return (
    <div aria-label="Carregando comparação" className="space-y-3" role="status">
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

const tint = {
  added: "bg-[var(--success-soft)]",
  removed: "bg-[var(--danger-soft)]",
  equal: "",
};
const strong = {
  added: "bg-emerald-200 text-[var(--success-strong)]",
  removed: "bg-rose-200 text-[var(--danger-strong)]",
};

const num =
  "select-none px-2 py-0.5 text-right align-top text-xs text-[var(--text-faint)]";
const text = "whitespace-pre-wrap break-words px-2 py-0.5 align-top";

function Words({
  segments,
  side,
}: {
  segments: Segment[];
  side: "added" | "removed";
}) {
  const hide = side === "added" ? "removed" : "added";
  return (
    <>
      {segments
        .filter((part) => part.kind !== hide)
        .map((part, index) => (
          <span
            className={part.kind === side ? `rounded-sm ${strong[side]}` : ""}
            key={index}
          >
            {part.text}
          </span>
        ))}
    </>
  );
}

function DiffTable({ mode, rows }: { mode: Mode; rows: DiffRow[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const items: CollapsedItem[] = collapse(rows);
  const expand = (index: number) =>
    setOpen((current) => new Set(current).add(index));

  const lines = items.flatMap((item, index) => {
    if ("hidden" in item)
      return open.has(index)
        ? item.hidden.map((row, at) => (
            <Row key={`${index}-${at}`} mode={mode} row={row} />
          ))
        : [
            <tr key={index}>
              <td className="bg-[var(--surface-subtle)] px-2 py-1" colSpan={4}>
                <Button onClick={() => expand(index)} size="sm" variant="quiet">
                  Mostrar {item.count} linhas iguais
                </Button>
              </td>
            </tr>,
          ];
    return [<Row key={index} mode={mode} row={item} />];
  });

  return (
    <Card className="overflow-x-auto">
      <table
        aria-label="Diferenças"
        className="w-full table-fixed border-collapse font-mono text-[13px] leading-5"
      >
        <colgroup>
          {mode === "unified" ? (
            <>
              <col className="w-11" />
              <col className="w-11" />
              <col className="w-6" />
              <col />
            </>
          ) : (
            <>
              <col className="w-11" />
              <col />
              <col className="w-11" />
              <col />
            </>
          )}
        </colgroup>
        <thead className="sr-only">
          {mode === "unified" ? (
            <tr>
              <th>Linha na base</th>
              <th>Linha na comparada</th>
              <th>Alteração</th>
              <th>Texto</th>
            </tr>
          ) : (
            <tr>
              <th>Linha na base</th>
              <th>Texto da base</th>
              <th>Linha na comparada</th>
              <th>Texto da comparada</th>
            </tr>
          )}
        </thead>
        <tbody>{lines}</tbody>
      </table>
    </Card>
  );
}

function Row({ mode, row }: { mode: Mode; row: DiffRow }) {
  if (mode === "split") return <SplitRow row={row} />;
  if (row.kind === "modified")
    return (
      <>
        <UnifiedLine
          kind="removed"
          line={row.baseLine}
          other={null}
          text={<Words segments={row.segments!} side="removed" />}
        />
        <UnifiedLine
          kind="added"
          line={null}
          other={row.nextLine}
          text={<Words segments={row.segments!} side="added" />}
        />
      </>
    );
  return (
    <UnifiedLine
      kind={row.kind as "equal" | "added" | "removed"}
      line={row.baseLine}
      other={row.nextLine}
      text={row.kind === "added" ? row.nextText : row.baseText}
    />
  );
}

function UnifiedLine({
  kind,
  line,
  other,
  text: content,
}: {
  kind: "equal" | "added" | "removed";
  line: number | null;
  other: number | null;
  text: ReactNode;
}) {
  return (
    <tr className={tint[kind]}>
      <td className={`${num}`}>{line}</td>
      <td className={`${num}`}>{other}</td>
      <td
        className={`w-6 select-none px-1 py-0.5 text-center align-top font-bold ${kind === "added" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
      >
        <span aria-hidden="true">
          {kind === "added" ? "+" : kind === "removed" ? "−" : ""}
        </span>
        <span className="sr-only">
          {kind === "added"
            ? "Adicionada"
            : kind === "removed"
              ? "Removida"
              : "Igual"}
        </span>
      </td>
      <td className={text}>{content}</td>
    </tr>
  );
}

function SplitRow({ row }: { row: DiffRow }) {
  const left = row.kind === "added" ? null : row.kind;
  const right = row.kind === "removed" ? null : row.kind;
  const leftKind = left === "modified" ? "removed" : left;
  const rightKind = right === "modified" ? "added" : right;
  return (
    <tr>
      <td className={`${num} ${leftKind ? tint[leftKind] : ""}`}>
        {row.baseLine}
      </td>
      <td className={`${text} ${leftKind ? tint[leftKind] : ""}`}>
        {leftKind === "removed" ? (
          <span
            aria-hidden="true"
            className="mr-1 font-bold text-[var(--danger)]"
          >
            −
          </span>
        ) : null}
        {row.kind === "modified" ? (
          <Words segments={row.segments!} side="removed" />
        ) : (
          row.baseText
        )}
      </td>
      <td
        className={`${num} border-l border-[var(--border)] ${rightKind ? tint[rightKind] : ""}`}
      >
        {row.nextLine}
      </td>
      <td className={`${text} ${rightKind ? tint[rightKind] : ""}`}>
        {rightKind === "added" ? (
          <span
            aria-hidden="true"
            className="mr-1 font-bold text-[var(--success)]"
          >
            +
          </span>
        ) : null}
        {row.kind === "modified" ? (
          <Words segments={row.segments!} side="added" />
        ) : (
          row.nextText
        )}
      </td>
    </tr>
  );
}
