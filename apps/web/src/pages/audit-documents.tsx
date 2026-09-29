import type {
  AuditDocumentFile,
  AuditDocumentList,
  AuditDocumentOptions,
  AuditDocumentStatus,
  AuditDocumentSummary,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  Input,
  TableSkeleton,
  Textarea,
  type ColumnDef,
} from "@cge/ui";
import {
  DownloadSimple,
  Eye,
  MagnifyingGlass,
  UploadSimple,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { useAuth } from "../auth";
import { FieldSelect } from "../components/field-select";
import { PageHeader } from "../components/page-header";
import { api, ApiError, json } from "../lib/api";
import { can } from "../lib/permissions";

export const auditStatusMeta: Record<
  AuditDocumentStatus,
  { label: string; variant: "neutral" | "success" | "warning" | "brand" }
> = {
  in_review: { label: "Em revisão", variant: "brand" },
  correction_requested: { label: "Aguardando correção", variant: "warning" },
  approved: { label: "Aprovado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "neutral" },
};

export const AUDIT_EYEBROW = "Controle Interno";
export const FILE_HINT =
  "Word (.docx) ou PDF, até 20 MB. PDF precisa ter texto pesquisável (OCR).";

type Tab = AuditDocumentStatus | "all";
const tabs: Array<{ key: Tab; label: string }> = [
  { key: "in_review", label: "Em revisão" },
  { key: "correction_requested", label: "Aguardando correção" },
  { key: "approved", label: "Aprovados" },
  { key: "all", label: "Todos" },
];

export function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  });
}

export function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof ApiError ? cause.message : fallback;
}

export const latestFile = (files: AuditDocumentFile[]) =>
  files.reduce<AuditDocumentFile | undefined>(
    (latest, file) => (!latest || file.number > latest.number ? file : latest),
    undefined,
  );

export const fileUrl = (
  documentId: string,
  fileId: string,
  disposition: "inline" | "attachment",
  track = true,
) =>
  `/api/audit-documents/${documentId}/files/${fileId}?disposition=${disposition}${track ? "" : "&track=false"}`;

export const compareUrl = (
  documentId: string,
  base: { id: string },
  next: { id: string },
) =>
  `/controle-interno/documentos/${documentId}/comparar?de=${base.id}&para=${next.id}`;

export function AuditDocumentsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (tabs.find((item) => item.key === params.get("tab"))?.key ??
    "in_review") as Tab;
  const unitId = params.get("equipe") ?? "";
  const category = params.get("categoria") ?? "";
  const query = params.get("q") ?? "";
  const page = Number(params.get("pagina")) || 1;
  const [search, setSearch] = useState(query);
  const [categoryInput, setCategoryInput] = useState(category);
  const [result, setResult] = useState<AuditDocumentList | null>(null);
  const [options, setOptions] = useState<AuditDocumentOptions | null>(null);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const canSubmit = Boolean(user && can(user, "audit_documents.submit"));

  const update = useCallback(
    (changes: Record<string, string>) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes))
            if (value) next.set(key, value);
            else next.delete(key);
          if (!("pagina" in changes)) next.delete("pagina");
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // Text filters wait for the user to stop typing before touching the URL.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() !== query) update({ q: search.trim() });
      if (categoryInput.trim() !== category)
        update({ categoria: categoryInput.trim() });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, categoryInput, query, category, update]);

  const load = useCallback(async () => {
    setError("");
    setResult(null);
    const search = new URLSearchParams({ page: String(page) });
    if (tab !== "all") search.set("status", tab);
    if (unitId) search.set("unitId", unitId);
    if (category) search.set("category", category);
    if (query) search.set("query", query);
    try {
      setResult(await api<AuditDocumentList>(`/api/audit-documents?${search}`));
    } catch (cause) {
      setError(errorMessage(cause, "Não foi possível carregar os documentos."));
    }
  }, [tab, unitId, category, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<AuditDocumentOptions>("/api/audit-documents/options")
      .then(setOptions)
      .catch(() => setOptions(null));
  }, []);

  const hasFilters = Boolean(unitId || category || query);
  const columns: ColumnDef<AuditDocumentSummary>[] = [
    {
      header: "Documento",
      cell: ({ row: { original } }) => (
        <div className="min-w-48">
          <Link
            className="font-semibold text-[var(--text)] hover:text-[var(--brand)] hover:underline"
            to={`/controle-interno/documentos/${original.id}`}
          >
            {original.title}
          </Link>
          <p className="text-xs text-[var(--text-faint)]">
            {[original.reference, original.category]
              .filter(Boolean)
              .join(" · ") || "Sem referência"}
          </p>
        </div>
      ),
    },
    {
      header: "Equipe",
      cell: ({ row: { original } }) => (
        <span className="whitespace-nowrap">{original.unitName}</span>
      ),
    },
    {
      header: "Situação",
      cell: ({ row: { original } }) => (
        <div className="flex flex-col items-start gap-1">
          <Badge
            className="whitespace-nowrap"
            variant={auditStatusMeta[original.status].variant}
          >
            {auditStatusMeta[original.status].label}
          </Badge>
          <span className="whitespace-nowrap text-xs text-[var(--text-faint)]">
            desde {formatDateTime(original.statusChangedAt)}
          </span>
          {original.correctionRounds ? (
            <span className="whitespace-nowrap text-xs text-[var(--text-faint)]">
              {original.correctionRounds === 1
                ? "1 correção"
                : `${original.correctionRounds} correções`}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Ações",
      cell: ({ row: { original } }) => (
        <div className="flex gap-1">
          <Button asChild size="icon" variant="quiet">
            <Link
              aria-label={`Abrir ${original.title}`}
              to={`/controle-interno/documentos/${original.id}`}
            >
              <Eye aria-hidden="true" size={16} />
            </Link>
          </Button>
          {original.status === "approved" ? (
            <Button asChild size="icon" variant="quiet">
              <a
                aria-label={`Baixar ${original.title}`}
                href={fileUrl(original.id, original.latestFileId, "attachment")}
              >
                <DownloadSimple aria-hidden="true" size={16} />
              </a>
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const emptyCopy = hasFilters
    ? {
        title: "Nenhum resultado",
        description: "Ajuste os filtros ou a busca para ver outros documentos.",
      }
    : {
        in_review: {
          title: "Nada em revisão",
          description:
            "Documentos enviados e ainda não analisados aparecem aqui.",
        },
        correction_requested: {
          title: "Nenhuma correção pendente",
          description:
            "Documentos devolvidos pela Subcontroladoria aparecem aqui até a nova versão.",
        },
        approved: {
          title: "Nenhum documento aprovado",
          description:
            "Os documentos aprovados ficam disponíveis para download aqui.",
        },
        cancelled: {
          title: "Nenhum documento cancelado",
          description: "Documentos cancelados aparecem aqui.",
        },
        all: {
          title: "Nenhum documento enviado",
          description:
            "Os documentos de auditoria enviados pelas equipes aparecem aqui.",
        },
      }[tab];

  return (
    <div className="page-enter space-y-4">
      <PageHeader
        actions={
          canSubmit ? (
            <Button onClick={() => setUploadOpen(true)}>
              <UploadSimple aria-hidden="true" size={16} />
              Enviar documento
            </Button>
          ) : null
        }
        description="Envio, revisão e aprovação dos documentos das equipes de auditoria."
        eyebrow={AUDIT_EYEBROW}
        title="Documentos de auditoria"
      />

      <nav
        aria-label="Situações dos documentos"
        className="flex flex-wrap gap-2"
      >
        {tabs.map((item) => {
          const count =
            item.key === "all" ? undefined : result?.counts[item.key];
          return (
            <Button
              aria-pressed={tab === item.key}
              key={item.key}
              onClick={() =>
                update({ tab: item.key === "in_review" ? "" : item.key })
              }
              variant={tab === item.key ? "primary" : "secondary"}
            >
              {item.label}
              {count !== undefined ? (
                <span className="tabular-nums opacity-80">{count}</span>
              ) : null}
            </Button>
          );
        })}
      </nav>

      {error ? (
        <Alert title="Não foi possível carregar os documentos" tone="danger">
          <p>{error}</p>
          <Button
            className="mt-3"
            onClick={() => void load()}
            size="sm"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">
              {tabs.find((item) => item.key === tab)?.label}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {tab === "approved"
                ? "Baixe a versão aprovada ou abra o documento para ver o histórico."
                : "Abra um documento para ler, decidir ou enviar nova versão."}
            </p>
          </div>
        </CardHeader>
        <CardContent className="border-b border-[var(--border)] py-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormField
              className="sm:col-span-2"
              htmlFor="auditSearch"
              label="Buscar documentos"
            >
              <div className="relative">
                <MagnifyingGlass
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                  size={16}
                />
                <Input
                  autoComplete="off"
                  className="pl-9"
                  id="auditSearch"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Título ou referência"
                  type="search"
                  value={search}
                />
              </div>
            </FormField>
            <FormField htmlFor="auditUnit" label="Equipe">
              <FieldSelect
                emptyLabel="Todas as equipes"
                id="auditUnit"
                name="auditUnit"
                onValueChange={(value) => update({ equipe: value })}
                options={(options?.visibleUnits ?? []).map((unit) => ({
                  label: unit.name,
                  value: unit.id,
                }))}
                value={unitId}
              />
            </FormField>
            <FormField htmlFor="auditCategory" label="Categoria">
              <Input
                autoComplete="off"
                id="auditCategory"
                list="auditCategories"
                onChange={(event) => setCategoryInput(event.target.value)}
                placeholder="Todas"
                value={categoryInput}
              />
            </FormField>
          </div>
          <CategoryList categories={options?.categories ?? []} />
        </CardContent>

        {!result && !error ? (
          <TableSkeleton
            ariaLabel="Carregando documentos"
            headers={["Documento", "Equipe", "Situação", "Ações"]}
          />
        ) : result?.total ? (
          <DataTable
            ariaLabel="Documentos de auditoria"
            columns={columns}
            data={result.documents}
            getRowId={(document) => document.id}
            itemLabel="documentos"
            onPageChange={(next) => update({ pagina: String(next) })}
            onPageSizeChange={() => undefined}
            page={result.page}
            pageSize={result.pageSize}
            pageSizeOptions={[result.pageSize]}
            total={result.total}
          />
        ) : result ? (
          <EmptyState
            action={
              canSubmit &&
              !hasFilters &&
              (tab === "all" || tab === "in_review") ? (
                <Button onClick={() => setUploadOpen(true)}>
                  <UploadSimple aria-hidden="true" size={16} />
                  Enviar documento
                </Button>
              ) : undefined
            }
            description={emptyCopy.description}
            title={emptyCopy.title}
          />
        ) : null}
      </Card>

      {canSubmit ? (
        <UploadDialog
          onOpenChange={setUploadOpen}
          open={uploadOpen}
          options={options}
        />
      ) : null}
    </div>
  );
}

function CategoryList({ categories }: { categories: string[] }) {
  return (
    <datalist id="auditCategories">
      {categories.map((category) => (
        <option key={category} value={category} />
      ))}
    </datalist>
  );
}

function UploadDialog({
  onOpenChange,
  open,
  options,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  options: AuditDocumentOptions | null;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const units = options?.units ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (options && file.size > options.maxFileBytes) {
      setError("O arquivo passa de 20 MB. Reduza o tamanho e envie de novo.");
      return;
    }
    const body = new FormData();
    body.append(
      "metadata",
      json({
        unitId: data.get("unitId"),
        title: data.get("title"),
        reference: data.get("reference"),
        category: data.get("category"),
      }),
    );
    body.append("file", file);
    setBusy(true);
    setError("");
    try {
      const created = await api<{ id: string }>("/api/audit-documents", {
        body,
        method: "POST",
      });
      onOpenChange(false);
      void navigate(`/controle-interno/documentos/${created.id}`);
    } catch (cause) {
      setError(errorMessage(cause, "Não foi possível enviar o documento."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!busy) {
          setError("");
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <DialogContent
        description="O documento entra em revisão pela Subcontroladoria assim que é enviado."
        title="Enviar documento"
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {error ? (
            <Alert title="Não foi possível enviar" tone="danger">
              {error}
            </Alert>
          ) : null}
          <FormField htmlFor="uploadUnit" label="Equipe">
            <FieldSelect
              defaultValue={units.length === 1 ? units[0]?.id : undefined}
              id="uploadUnit"
              name="unitId"
              options={units.map((unit) => ({
                label: unit.name,
                value: unit.id,
              }))}
              placeholder="Selecione a equipe"
              required
            />
          </FormField>
          <FormField htmlFor="uploadTitle" label="Título">
            <Input
              id="uploadTitle"
              maxLength={200}
              minLength={3}
              name="title"
              required
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="uploadCategory" label="Categoria (opcional)">
              <Input
                autoComplete="off"
                id="uploadCategory"
                list="auditCategories"
                maxLength={80}
                name="category"
              />
            </FormField>
            <FormField htmlFor="uploadReference" label="Referência (opcional)">
              <Input
                id="uploadReference"
                maxLength={120}
                name="reference"
                placeholder="Ex.: processo ou ordem de serviço"
              />
            </FormField>
          </div>
          <FormField hint={FILE_HINT} htmlFor="uploadFile" label="Arquivo">
            <Input
              accept=".docx,.pdf"
              className="py-2"
              id="uploadFile"
              name="file"
              required
              type="file"
            />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={busy}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? "Enviando…" : "Enviar documento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NoteField({
  id,
  label,
  required,
}: {
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <FormField htmlFor={id} label={label}>
      <Textarea
        id={id}
        maxLength={2000}
        minLength={required ? 3 : undefined}
        name="message"
        required={required}
      />
    </FormField>
  );
}
