import type {
  Visit,
  VisitLocation,
  VisitPageResult,
  VisitSummary,
  VisitType,
} from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DatePicker,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  Input,
  Select,
  TableSkeleton,
  Textarea,
  type ColumnDef,
} from "@cge/ui";

import { MagnifyingGlass } from "@phosphor-icons/react";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { VisitDetail } from "../components/visit-ui";
import { api, json } from "../lib/api";
import {
  formatVisitDate,
  formatVisitDateTime,
  formatVisitTime,
  visitErrorMessage,
  visitLocationOptions,
  visitorConfirmationMeta,
  visitStatusMeta,
  visitTypeLabels,
} from "../lib/visit-labels";

type VisitForm = {
  type: VisitType;

  subject: string;

  description: string;

  organization: string;

  sector: string;

  scheduledDate: string;

  startTime: string;

  endTime: string;

  location: VisitLocation | "";

  visitorName: string;

  visitorPosition: string;

  visitorOrganization: string;

  visitorSector: string;

  visitorEmail: string;

  visitorPhone: string;

  visitorCpf: string;
};

const initialForm: VisitForm = {
  type: "technical_visit",

  subject: "",

  description: "",

  organization: "",

  sector: "",

  scheduledDate: "",

  startTime: "",

  endTime: "",

  location: "",

  visitorName: "",

  visitorPosition: "",

  visitorOrganization: "",

  visitorSector: "",

  visitorEmail: "",

  visitorPhone: "",

  visitorCpf: "",
};

type FieldErrors = Partial<
  Record<"scheduledDate" | "location" | "endTime", string>
>;

const typeOptions = Object.entries(visitTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const tableHeaders = [
  "Protocolo",
  "Data",
  "Motivo",
  "Sala",
  "Situação",
  "Ações",
];

export function VisitManagePage() {
  const [form, setForm] = useState<VisitForm>(initialForm);

  const [formVersion, setFormVersion] = useState(0);

  const [visits, setVisits] = useState<VisitSummary[]>([]);

  const [query, setQuery] = useState("");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [detail, setDetail] = useState<Visit | null>(null);

  const loadVisits = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),

        pageSize: String(pageSize),
      });

      if (search) {
        params.set("query", search);
      }

      const result = await api<VisitPageResult>(
        `/api/visits?${params.toString()}`,
      );

      setVisits(result.visits);

      setTotal(result.pagination.total);
    } catch (cause) {
      setError(
        visitErrorMessage(cause, "Não foi possível carregar as visitas."),
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    const normalized = query.trim();

    if (normalized === search) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPage(1);

      setSearch(normalized);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query, search]);

  function updateField<K extends keyof VisitForm>(
    field: K,
    value: VisitForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);

    setEditingId(null);

    setFieldErrors({});

    setFormVersion((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const data = new FormData(event.currentTarget);

    const scheduledDate = String(data.get("scheduledDate") ?? "");

    const nextFieldErrors: FieldErrors = {};

    if (!scheduledDate) nextFieldErrors.scheduledDate = "Informe a data.";

    if (!form.location) nextFieldErrors.location = "Selecione a sala.";

    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      nextFieldErrors.endTime =
        "O horário final deve ser posterior ao horário inicial.";
    }

    setFieldErrors(nextFieldErrors);

    if (
      !form.subject.trim() ||
      !form.organization.trim() ||
      !scheduledDate ||
      !form.startTime ||
      !form.endTime ||
      !form.location ||
      !form.visitorName.trim() ||
      !form.visitorEmail.trim()
    ) {
      setError("Preencha os campos obrigatórios destacados antes de salvar.");

      return;
    }

    if (nextFieldErrors.endTime) {
      return;
    }

    try {
      setBusy(true);

      const body = {
        type: form.type,

        subject: form.subject.trim(),

        description: form.description.trim() || null,

        organization: form.organization.trim(),

        sector: form.sector.trim() || null,

        scheduledDate,

        startTime: form.startTime,

        endTime: form.endTime,

        location: form.location,

        responsibleUnitId: null,

        responsibleAccountId: null,

        visitors: [
          {
            name: form.visitorName.trim(),

            position: form.visitorPosition.trim() || null,

            organization:
              form.visitorOrganization.trim() || form.organization.trim(),

            sector: form.visitorSector.trim() || null,

            email: form.visitorEmail.trim() || null,

            phone: form.visitorPhone.trim() || null,

            cpf: form.visitorCpf.trim() || null,
          },
        ],
      };

      if (editingId) {
        await api(`/api/visits/${editingId}`, {
          method: "PATCH",

          body: json(body),
        });

        setSuccess("Visita atualizada com sucesso.");
      } else {
        await api("/api/visits", {
          method: "POST",

          body: json(body),
        });

        setSuccess("Visita cadastrada com sucesso.");
      }

      resetForm();

      await loadVisits();
    } catch (cause) {
      setError(visitErrorMessage(cause, "Não foi possível salvar a visita."));
    } finally {
      setBusy(false);
    }
  }

  async function viewVisit(id: string) {
    try {
      const result = await api<Visit>(`/api/visits/${id}`);

      setDetail(result);
    } catch (cause) {
      setError(
        visitErrorMessage(cause, "Não foi possível consultar a visita."),
      );
    }
  }

  async function editVisit(id: string) {
    try {
      const visit = await api<Visit>(`/api/visits/${id}`);

      const visitor = visit.visitors[0];

      setEditingId(id);

      setForm({
        type: visit.type,

        subject: visit.subject,

        description: visit.description ?? "",

        organization: visit.organization,

        sector: visit.sector ?? "",

        scheduledDate: visit.scheduledDate,

        startTime: visit.startTime.slice(0, 5),

        endTime: visit.endTime.slice(0, 5),

        location: visit.location,

        visitorName: visitor?.name ?? "",

        visitorPosition: visitor?.position ?? "",

        visitorOrganization: visitor?.organization ?? "",

        visitorSector: visitor?.sector ?? "",

        visitorEmail: visitor?.email ?? "",

        visitorPhone: visitor?.phone ?? "",

        visitorCpf: visitor?.cpf ?? "",
      });

      setFormVersion((value) => value + 1);

      window.scrollTo({
        top: 0,

        behavior: "smooth",
      });
    } catch (cause) {
      setError(visitErrorMessage(cause, "Não foi possível carregar a visita."));
    }
  }

  async function removeVisit(id: string) {
    try {
      setBusy(true);

      await api(`/api/visits/${id}`, {
        method: "DELETE",
      });

      setSuccess("Visita excluída com sucesso.");

      await loadVisits();
    } catch (cause) {
      setError(visitErrorMessage(cause, "Não foi possível excluir a visita."));
    } finally {
      setBusy(false);
    }
  }

  async function releaseReception(id: string) {
    try {
      setBusy(true);

      await api(`/api/visits/${id}/release-reception`, {
        method: "POST",
      });

      setSuccess("Visita liberada para a recepção.");

      await loadVisits();
    } catch (cause) {
      setError(visitErrorMessage(cause, "Não foi possível liberar a visita."));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation(id: string) {
    try {
      setBusy(true);
      setError("");
      setSuccess("");

      await api(`/api/visits/${id}/send-confirmation`, {
        method: "POST",
      });

      const updated = await api<Visit>(`/api/visits/${id}`);

      setDetail(updated);

      setSuccess("E-mail de confirmação reenviado com sucesso.");

      await loadVisits();
    } catch (cause) {
      setError(
        visitErrorMessage(
          cause,
          "Não foi possível reenviar a confirmação da visita.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: ColumnDef<VisitSummary>[] = [
    {
      header: "Protocolo",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-semibold">
          {row.original.protocol}
        </span>
      ),
    },
    {
      header: "Data",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatVisitDate(row.original.scheduledDate)}
        </span>
      ),
    },
    {
      header: "Motivo",
      cell: ({ row }) => (
        <span className="line-clamp-2 min-w-48">{row.original.subject}</span>
      ),
    },
    {
      header: "Sala",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{row.original.location}</span>
      ),
    },
    {
      header: "Situação",
      cell: ({ row }) => (
        <Badge
          className="whitespace-nowrap"
          variant={visitStatusMeta[row.original.status].variant}
        >
          {visitStatusMeta[row.original.status].label}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Ações</span>,
      cell: ({ row }) => {
        const visit = row.original;

        return (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            {["pending", "approved"].includes(visit.status) ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void releaseReception(visit.id)}
              >
                Liberar
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="quiet"
              onClick={() => void viewVisit(visit.id)}
            >
              Ver detalhes
            </Button>

            <Button
              size="sm"
              variant="quiet"
              onClick={() => void editVisit(visit.id)}
            >
              Editar
            </Button>

            {["pending", "rejected", "cancelled"].includes(visit.status) ? (
              <ConfirmDialog
                busyLabel="Excluindo…"
                confirmLabel="Excluir visita"
                description={`A visita ${visit.protocol} será removida da agenda e do histórico. Esta ação não pode ser desfeita.`}
                onConfirm={() => removeVisit(visit.id)}
                title="Excluir visita?"
              >
                <Button disabled={busy} size="sm" variant="quiet">
                  Excluir
                </Button>
              </ConfirmDialog>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Agendamento de Visitas
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            {editingId ? "Editar visita" : "Nova visita"}
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Cadastre e gerencie visitas, reuniões e atendimentos técnicos.
          </p>
        </div>
      </div>

      {error ? (
        <Alert title="A operação não foi concluída" tone="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Operação concluída" tone="success">
          {success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">
              {editingId ? "Editar agendamento" : "Cadastrar nova visita"}
            </h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              O visitante recebe o convite de confirmação no e-mail informado.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form className="space-y-6" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="visit-type" label="Tipo da visita">
                <Select
                  id="visit-type"
                  name="type"
                  required
                  options={typeOptions}
                  value={form.type}
                  onValueChange={(value) =>
                    updateField("type", value as VisitType)
                  }
                />
              </FormField>

              <FormField
                htmlFor="visit-organization"
                label="Órgão / instituição"
              >
                <Input
                  id="visit-organization"
                  required
                  value={form.organization}
                  onChange={(event) =>
                    updateField("organization", event.target.value)
                  }
                />
              </FormField>

              <FormField htmlFor="visit-sector" label="Setor (opcional)">
                <Input
                  id="visit-sector"
                  value={form.sector}
                  onChange={(event) =>
                    updateField("sector", event.target.value)
                  }
                />
              </FormField>

              <FormField
                htmlFor="visit-subject"
                label="Motivo / assunto da visita"
              >
                <Input
                  id="visit-subject"
                  required
                  value={form.subject}
                  onChange={(event) =>
                    updateField("subject", event.target.value)
                  }
                />
              </FormField>

              <FormField
                htmlFor="visit-date"
                label="Data"
                error={fieldErrors.scheduledDate}
              >
                <DatePicker
                  key={`${formVersion}-${form.scheduledDate}`}
                  id="visit-date"
                  name="scheduledDate"
                  required
                  defaultValue={form.scheduledDate}
                  placeholder="Selecione a data"
                />
              </FormField>

              <FormField
                htmlFor="visit-location"
                label="Sala da visita"
                error={fieldErrors.location}
              >
                <Select
                  aria-invalid={Boolean(fieldErrors.location)}
                  id="visit-location"
                  name="location"
                  options={visitLocationOptions}
                  placeholder="Selecione a sala"
                  value={form.location}
                  onValueChange={(value) =>
                    updateField("location", value as VisitLocation)
                  }
                />
              </FormField>

              <FormField htmlFor="start-time" label="Hora inicial">
                <Input
                  id="start-time"
                  required
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    updateField("startTime", event.target.value)
                  }
                />
              </FormField>

              <FormField
                htmlFor="end-time"
                label="Hora final"
                error={fieldErrors.endTime}
              >
                <Input
                  aria-invalid={Boolean(fieldErrors.endTime)}
                  id="end-time"
                  required
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    updateField("endTime", event.target.value)
                  }
                />
              </FormField>
            </div>

            <FormField
              htmlFor="description"
              label="Descrição / objetivo (opcional)"
            >
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
              />
            </FormField>

            <section className="border-t border-[var(--border)] pt-5">
              <h3 className="font-bold">Dados do visitante / técnico</h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField htmlFor="visitor-name" label="Nome completo">
                  <Input
                    id="visitor-name"
                    required
                    value={form.visitorName}
                    onChange={(event) =>
                      updateField("visitorName", event.target.value)
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-position"
                  label="Cargo / função (opcional)"
                >
                  <Input
                    id="visitor-position"
                    value={form.visitorPosition}
                    onChange={(event) =>
                      updateField("visitorPosition", event.target.value)
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-organization"
                  label="Órgão do visitante (opcional)"
                  hint="Se vazio, usa o órgão da visita."
                >
                  <Input
                    id="visitor-organization"
                    value={form.visitorOrganization}
                    onChange={(event) =>
                      updateField("visitorOrganization", event.target.value)
                    }
                  />
                </FormField>

                <FormField htmlFor="visitor-sector" label="Setor (opcional)">
                  <Input
                    id="visitor-sector"
                    value={form.visitorSector}
                    onChange={(event) =>
                      updateField("visitorSector", event.target.value)
                    }
                  />
                </FormField>

                <FormField htmlFor="visitor-email" label="E-mail">
                  <Input
                    id="visitor-email"
                    type="email"
                    required
                    value={form.visitorEmail}
                    onChange={(event) =>
                      updateField("visitorEmail", event.target.value)
                    }
                  />
                </FormField>

                <FormField htmlFor="visitor-phone" label="Telefone (opcional)">
                  <Input
                    id="visitor-phone"
                    type="tel"
                    value={form.visitorPhone}
                    onChange={(event) =>
                      updateField("visitorPhone", event.target.value)
                    }
                  />
                </FormField>

                <FormField htmlFor="visitor-cpf" label="CPF (opcional)">
                  <Input
                    id="visitor-cpf"
                    inputMode="numeric"
                    value={form.visitorCpf}
                    onChange={(event) =>
                      updateField("visitorCpf", event.target.value)
                    }
                  />
                </FormField>
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              {editingId ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar edição
                </Button>
              ) : null}

              <Button type="submit" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : editingId
                    ? "Salvar alterações"
                    : "Salvar visita"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Visitas cadastradas</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Consulte, edite ou libere os agendamentos para a recepção.
            </p>
          </div>
        </CardHeader>

        <CardContent className="border-b border-[var(--border)] py-4">
          <FormField htmlFor="manage-search" label="Buscar">
            <div className="relative">
              <MagnifyingGlass
                aria-hidden="true"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />

              <Input
                autoComplete="off"
                className="pl-9"
                id="manage-search"
                placeholder="Protocolo, órgão ou motivo"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </FormField>
        </CardContent>

        {loading ? (
          <TableSkeleton
            ariaLabel="Carregando visitas"
            headers={tableHeaders}
            rows={4}
          />
        ) : total ? (
          <DataTable
            ariaLabel="Visitas cadastradas"
            columns={columns}
            data={visits}
            getRowId={(visit) => visit.id}
            itemLabel="visitas"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50]}
            total={total}
          />
        ) : search ? (
          <EmptyState
            title="Nenhum resultado para a busca"
            description="Confira o protocolo, o órgão ou o motivo informado."
          />
        ) : (
          <EmptyState
            title="Nenhuma visita cadastrada"
            description="Os agendamentos salvos no formulário acima aparecerão aqui."
          />
        )}
      </Card>

      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
      >
        <DialogContent
          className="max-w-2xl"
          title="Detalhes da visita"
          description="Consulte o agendamento e acompanhe a confirmação enviada ao visitante."
        >
          {detail ? (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <VisitDetail label="Protocolo">{detail.protocol}</VisitDetail>

                <VisitDetail label="Sala">{detail.location}</VisitDetail>

                <VisitDetail label="Órgão">{detail.organization}</VisitDetail>

                <VisitDetail label="Motivo">{detail.subject}</VisitDetail>

                <VisitDetail label="Data">
                  {formatVisitDate(detail.scheduledDate)}
                </VisitDetail>

                <VisitDetail label="Horário">
                  {formatVisitTime(detail.startTime, detail.endTime)}
                </VisitDetail>

                <VisitDetail label="Situação">
                  <Badge
                    className="whitespace-nowrap"
                    variant={visitStatusMeta[detail.status].variant}
                  >
                    {visitStatusMeta[detail.status].label}
                  </Badge>
                </VisitDetail>

                <VisitDetail label="Tipo">
                  {visitTypeLabels[detail.type] ?? detail.type}
                </VisitDetail>
              </dl>

              <section className="mt-6 border-t border-[var(--border)] pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Visitantes e confirmação</h3>

                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      A situação é atualizada quando o visitante responde ao
                      link recebido por e-mail.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      busy ||
                      !detail.visitors.some((visitor) =>
                        Boolean(visitor.email?.trim()),
                      )
                    }
                    onClick={() => void resendConfirmation(detail.id)}
                  >
                    {busy ? "Reenviando…" : "Reenviar confirmação"}
                  </Button>
                </div>

                <ul className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                  {detail.visitors.map((visitor) => {
                    const confirmation =
                      visitorConfirmationMeta[visitor.confirmationStatus];

                    return (
                      <li className="py-4" key={visitor.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {visitor.name}
                            </p>

                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                              {visitor.position ?? "Cargo não informado"}
                            </p>
                          </div>

                          <Badge variant={confirmation?.variant ?? "neutral"}>
                            {confirmation?.label ?? "Não informado"}
                          </Badge>
                        </div>

                        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                          <VisitDetail label="E-mail">
                            {visitor.email ?? "Não informado"}
                          </VisitDetail>

                          <VisitDetail label="Telefone">
                            {visitor.phone ?? "Não informado"}
                          </VisitDetail>

                          <VisitDetail label="Órgão">
                            {visitor.organization}
                          </VisitDetail>

                          <VisitDetail label="Setor">
                            {visitor.sector ?? "Não informado"}
                          </VisitDetail>

                          <VisitDetail label="Convite enviado em">
                            {formatVisitDateTime(visitor.confirmationSentAt)}
                          </VisitDetail>

                          <VisitDetail label="Resposta recebida em">
                            {formatVisitDateTime(
                              visitor.confirmationRespondedAt,
                            )}
                          </VisitDetail>

                          <VisitDetail label="Validade do convite">
                            {formatVisitDateTime(visitor.confirmationExpiresAt)}
                          </VisitDetail>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
