import type {
  AuditDocumentAction,
  AuditDocumentDetail,
  AuditDocumentEvent,
  AuditDocumentFile,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  Dialog,
  DialogContent,
  FormField,
  Input,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
  Toast,
} from "@cge/ui";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  CheckCircle,
  GitDiff,
  DownloadSimple,
  PencilSimple,
  PencilSimpleLine,
  UploadSimple,
  XCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";

import { DocumentViewer } from "../components/document-viewer";
import { FieldSelect } from "../components/field-select";
import { PageHeader } from "../components/page-header";
import { api, json } from "../lib/api";
import {
  AUDIT_EYEBROW,
  auditStatusMeta,
  errorMessage,
  FILE_HINT,
  fileUrl,
  formatDateTime,
  compareUrl,
  latestFile,
  NoteField,
} from "./audit-documents";

type DialogAction =
  "request_correction" | "submit_version" | "cancel" | "reopen";

const eventLabels: Record<AuditDocumentEvent["type"], string> = {
  submitted: "Documento enviado",
  resubmitted: "Nova versão enviada",
  correction_requested: "Correção solicitada",
  approved: "Documento aprovado",
  cancelled: "Documento cancelado",
  reopened: "Documento reaberto",
  edited: "Versão editada pela Subcontroladoria",
  read: "Visualizado",
};

const dialogCopy: Record<
  DialogAction,
  { title: string; description: string; submit: string; busy: string }
> = {
  request_correction: {
    title: "Solicitar correção",
    description:
      "A equipe recebe o documento de volta com a sua orientação e envia uma nova versão.",
    submit: "Solicitar correção",
    busy: "Enviando…",
  },
  submit_version: {
    title: "Enviar nova versão",
    description: "A nova versão volta para revisão da Subcontroladoria.",
    submit: "Enviar versão",
    busy: "Enviando…",
  },
  cancel: {
    title: "Cancelar documento",
    description:
      "O documento sai do fluxo de revisão. O histórico e os arquivos continuam guardados.",
    submit: "Cancelar documento",
    busy: "Cancelando…",
  },
  reopen: {
    title: "Reabrir documento",
    description:
      "O documento aprovado volta para revisão. Informe o motivo para a equipe.",
    submit: "Reabrir documento",
    busy: "Reabrindo…",
  },
};

export function AuditDocumentPage() {
  const { id = "" } = useParams();
  const [document, setDocument] = useState<AuditDocumentDetail | null>(null);
  const [error, setError] = useState("");
  const [fileId, setFileId] = useState("");
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await api<AuditDocumentDetail>(`/api/audit-documents/${id}`);
      setDocument(next);
      setFileId(latestFile(next.files)?.id ?? "");
    } catch (cause) {
      setError(errorMessage(cause, "Não foi possível carregar o documento."));
    }
  }, [id]);

  useEffect(() => {
    setDocument(null);
    void load();
  }, [load]);

  if (!document)
    return (
      <div className="page-enter space-y-4">
        <BackLink />
        {error ? (
          <Alert title="Documento indisponível" tone="danger">
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
        ) : (
          <div
            aria-label="Carregando documento"
            className="space-y-4"
            role="status"
          >
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}
      </div>
    );

  const latest = latestFile(document.files);
  const selected =
    document.files.find((file) => file.id === fileId) ?? latest ?? null;
  // The API already folds in permission, state and separation of duty
  // (whoever sent the latest file cannot decide on it).
  const allows = (action: AuditDocumentAction) =>
    document.allowedActions.includes(action);
  const status = auditStatusMeta[document.status];
  const previousOf = (file: AuditDocumentFile) =>
    document.files
      .filter((other) => other.number < file.number)
      .sort((left, right) => right.number - left.number)[0];

  async function approve() {
    try {
      await api(`/api/audit-documents/${id}/transition`, {
        body: json({ action: "approve", version: document!.version }),
        method: "POST",
      });
    } catch (cause) {
      throw new Error(errorMessage(cause, "Não foi possível aprovar."), {
        cause,
      });
    }
    await load();
    setToast("Documento aprovado.");
  }

  return (
    <div className="page-enter space-y-4">
      <BackLink />
      <PageHeader
        actions={
          <>
            {allows("approve") ? (
              <ConfirmDialog
                busyLabel="Aprovando…"
                confirmLabel="Aprovar documento"
                description="A versão atual fica registrada como aprovada e disponível para download."
                onConfirm={approve}
                title="Aprovar documento?"
              >
                <Button>
                  <CheckCircle aria-hidden="true" size={16} />
                  Aprovar
                </Button>
              </ConfirmDialog>
            ) : null}
            {allows("request_correction") ? (
              <Button
                onClick={() => setDialog("request_correction")}
                variant="secondary"
              >
                <PencilSimpleLine aria-hidden="true" size={16} />
                Solicitar correção
              </Button>
            ) : null}
            {latest?.kind === "docx" &&
            (allows("edit_version") || allows("submit_version")) ? (
              <Button asChild variant="secondary">
                <Link to={`/controle-interno/documentos/${document.id}/editar`}>
                  <PencilSimple aria-hidden="true" size={16} />
                  Editar no navegador
                </Link>
              </Button>
            ) : null}
            {allows("submit_version") ? (
              <Button onClick={() => setDialog("submit_version")}>
                <UploadSimple aria-hidden="true" size={16} />
                Enviar nova versão
              </Button>
            ) : null}
            {allows("reopen") ? (
              <Button onClick={() => setDialog("reopen")} variant="secondary">
                <ArrowCounterClockwise aria-hidden="true" size={16} />
                Reabrir
              </Button>
            ) : null}
            {allows("cancel") ? (
              <Button onClick={() => setDialog("cancel")} variant="quiet">
                <XCircle aria-hidden="true" size={16} />
                Cancelar
              </Button>
            ) : null}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <span>
              {[document.unitName, document.category, document.reference]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        }
        eyebrow={AUDIT_EYEBROW}
        title={document.title}
      />

      {error ? (
        <Alert title="Não foi possível atualizar" tone="danger">
          {error}
        </Alert>
      ) : null}

      {document.status === "correction_requested" ? (
        <Alert title="Correção solicitada" tone="warning">
          {lastMessage(document.events, "correction_requested")}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <CardHeader className="flex-wrap gap-3">
            <div>
              <h2 className="font-bold">Arquivo</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {selected
                  ? `${selected.fileName} · ${formatSize(selected.size)}`
                  : "Nenhum arquivo enviado."}
              </p>
            </div>
            {selected ? (
              <div className="flex flex-wrap items-end gap-2">
                <FieldSelect
                  aria-label="Versão"
                  className="min-h-9 w-40"
                  id="auditVersion"
                  name="auditVersion"
                  onValueChange={setFileId}
                  options={[...document.files]
                    .sort((left, right) => right.number - left.number)
                    .map((file) => ({
                      label:
                        file.id === latest?.id
                          ? `Versão ${file.number} (atual)`
                          : `Versão ${file.number}`,
                      value: file.id,
                    }))}
                  value={selected.id}
                />
                <Button asChild size="sm" variant="secondary">
                  <a href={fileUrl(document.id, selected.id, "attachment")}>
                    <DownloadSimple aria-hidden="true" size={16} />
                    Baixar
                  </a>
                </Button>
                <CompareButton
                  documentId={document.id}
                  file={selected}
                  previous={previousOf(selected)}
                />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            {selected ? (
              <DocumentViewer
                key={selected.id}
                kind={selected.kind}
                title={`Visualização da versão ${selected.number}`}
                url={fileUrl(document.id, selected.id, "inline")}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div>
              <h2 className="font-bold">Histórico</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Envios, decisões e leituras, do mais recente ao mais antigo.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Timeline document={document} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Versões</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Cada envio fica guardado e não pode ser alterado.
            </p>
          </div>
        </CardHeader>
        <Table aria-label="Versões do documento">
          <thead>
            <tr>
              {[
                "Versão",
                "Arquivo",
                "Enviado por",
                "Data",
                "Observação",
                "Ações",
              ].map((header) => (
                <TableHead className="whitespace-nowrap" key={header}>
                  {header}
                </TableHead>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...document.files]
              .sort((left, right) => right.number - left.number)
              .map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="whitespace-nowrap font-semibold">
                    Versão {file.number}
                  </TableCell>
                  <TableCell>
                    <p className="min-w-40 break-words">{file.fileName}</p>
                    <p className="text-xs text-[var(--text-faint)]">
                      {file.kind.toUpperCase()} · {formatSize(file.size)}
                      {file.source === "editor"
                        ? " · editado no navegador"
                        : ""}
                    </p>
                  </TableCell>
                  <TableCell>{file.uploadedByName}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(file.createdAt)}
                  </TableCell>
                  <TableCell className="min-w-48 text-[var(--text-muted)]">
                    {file.note ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <CompareButton
                      documentId={document.id}
                      file={file}
                      label="Comparar com anterior"
                      previous={previousOf(file)}
                      variant="quiet"
                    />
                    <Button asChild size="icon" variant="quiet">
                      <a
                        aria-label={`Baixar versão ${file.number}`}
                        href={fileUrl(document.id, file.id, "attachment")}
                      >
                        <DownloadSimple aria-hidden="true" size={16} />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </tbody>
        </Table>
      </Card>

      <ActionDialog
        action={dialog}
        document={document}
        onClose={() => setDialog(null)}
        onDone={async (message) => {
          setDialog(null);
          setToast(message);
          await load();
        }}
      />
      {toast ? <Toast onDismiss={() => setToast("")} title={toast} /> : null}
    </div>
  );
}

function CompareButton({
  documentId,
  file,
  label = "Comparar",
  previous,
  variant = "secondary",
}: {
  documentId: string;
  file: AuditDocumentFile;
  label?: string;
  previous: AuditDocumentFile | undefined;
  variant?: "secondary" | "quiet";
}) {
  if (!previous) return null;
  if (file.kind !== "docx" || previous.kind !== "docx")
    return (
      <Button
        disabled
        size="sm"
        title="A comparação só está disponível para arquivos Word."
        variant={variant}
      >
        <GitDiff aria-hidden="true" size={16} />
        {label}
      </Button>
    );
  return (
    <Button asChild size="sm" variant={variant}>
      <Link to={compareUrl(documentId, previous, file)}>
        <GitDiff aria-hidden="true" size={16} />
        {label}
      </Link>
    </Button>
  );
}

function BackLink() {
  return (
    <Button asChild className="-ml-2" size="sm" variant="quiet">
      <Link to="/controle-interno/documentos">
        <ArrowLeft aria-hidden="true" size={16} />
        Documentos de auditoria
      </Link>
    </Button>
  );
}

function Timeline({ document }: { document: AuditDocumentDetail }) {
  const numbers = new Map(document.files.map((file) => [file.id, file.number]));
  const events = [...document.events].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  return (
    <ol className="space-y-4" aria-label="Histórico do documento">
      {events.map((event) => {
        const version = event.fileId ? numbers.get(event.fileId) : undefined;
        return (
          <li className="border-l-2 border-[var(--border)] pl-3" key={event.id}>
            <p className="text-sm font-semibold">
              {event.type === "read"
                ? `Visualizado por ${event.actorName}`
                : eventLabels[event.type]}
            </p>
            <p className="text-xs text-[var(--text-faint)]">
              {[
                version ? `Versão ${version}` : null,
                event.type === "read" ? null : event.actorName,
                formatDateTime(event.createdAt),
                event.delegation
                  ? `em substituição a ${event.delegation.originalName}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {event.message ? (
              <p className="mt-1 whitespace-pre-line break-words text-sm text-[var(--text-muted)]">
                {event.message}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ActionDialog({
  action,
  document,
  onClose,
  onDone,
}: {
  action: DialogAction | null;
  document: AuditDocumentDetail;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = action ? dialogCopy[action] : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const data = new FormData(event.currentTarget);
    const message = String(data.get("message") ?? "").trim();
    setBusy(true);
    setError("");
    try {
      if (action === "submit_version") {
        const file = data.get("file");
        if (!(file instanceof File) || !file.size) return;
        const body = new FormData();
        body.append(
          "metadata",
          json({ version: document.version, note: message || null }),
        );
        body.append("file", file);
        await api(`/api/audit-documents/${document.id}/files`, {
          body,
          method: "POST",
        });
        await onDone("Nova versão enviada para revisão.");
      } else {
        await api(`/api/audit-documents/${document.id}/transition`, {
          body: json({ action, version: document.version, message }),
          method: "POST",
        });
        await onDone(
          {
            request_correction: "Correção solicitada à equipe.",
            cancel: "Documento cancelado.",
            reopen: "Documento reaberto para revisão.",
          }[action],
        );
      }
    } catch (cause) {
      setError(errorMessage(cause, "Não foi possível concluir a ação."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !busy) {
          setError("");
          onClose();
        }
      }}
      open={Boolean(action)}
    >
      {copy ? (
        <DialogContent description={copy.description} title={copy.title}>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            {error ? (
              <Alert title="Não foi possível concluir" tone="danger">
                {error}
              </Alert>
            ) : null}
            {action === "submit_version" ? (
              <FormField hint={FILE_HINT} htmlFor="versionFile" label="Arquivo">
                <Input
                  accept=".docx,.pdf"
                  className="py-2"
                  id="versionFile"
                  name="file"
                  required
                  type="file"
                />
              </FormField>
            ) : null}
            <NoteField
              id="actionMessage"
              label={
                action === "submit_version"
                  ? "Observação (opcional)"
                  : action === "request_correction"
                    ? "O que precisa ser corrigido"
                    : "Motivo"
              }
              required={action !== "submit_version"}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={busy}
                onClick={onClose}
                type="button"
                variant="secondary"
              >
                Voltar
              </Button>
              <Button
                disabled={busy}
                type="submit"
                variant={action === "cancel" ? "danger" : "primary"}
              >
                {busy ? copy.busy : copy.submit}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function lastMessage(
  events: AuditDocumentEvent[],
  type: AuditDocumentEvent["type"],
) {
  return (
    [...events]
      .filter((event) => event.type === type)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )[0]?.message ?? ""
  );
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
