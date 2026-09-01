import type {
  Visit,
  VisitLocation,
  VisitPageResult,
  
  VisitSummary,
  VisitType,
  VisitorConfirmationStatus,
} from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DatePicker,
  EmptyState,
  FormField,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";

import {
  Eye,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  UserCheck,
  X,
} from "@phosphor-icons/react";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  api,
  ApiError,
  json,
} from "../lib/api";

import {
  visitLocationOptions,
  visitStatusLabels,
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

  location:
    VisitLocation | "";

  visitorName: string;

  visitorPosition: string;

  visitorOrganization: string;

  visitorSector: string;

  visitorEmail: string;

  visitorPhone: string;

  visitorCpf: string;
};

const initialForm: VisitForm = {
  type:
    "technical_visit",

  subject:
    "",

  description:
    "",

  organization:
    "",

  sector:
    "",

  scheduledDate:
    "",

  startTime:
    "",

  endTime:
    "",

  location:
    "",

  visitorName:
    "",

  visitorPosition:
    "",

  visitorOrganization:
    "",

  visitorSector:
    "",

  visitorEmail:
    "",

  visitorPhone:
    "",

  visitorCpf:
    "",
};

const visitorConfirmationLabels: Record<
  VisitorConfirmationStatus,
  string
> = {
  not_sent:
    "NÃO ENVIADO",

  pending:
    "AGUARDANDO CONFIRMAÇÃO",

  confirmed:
    "PRESENÇA CONFIRMADA",

  declined:
    "NÃO COMPARECERÁ",

  expired:
    "CONVITE EXPIRADO",
};

export function VisitManagePage() {
  const [
    form,
    setForm,
  ] =
    useState<VisitForm>(
      initialForm,
    );

  const [
    formVersion,
    setFormVersion,
  ] =
    useState(0);

  const [
    visits,
    setVisits,
  ] =
    useState<
      VisitSummary[]
    >([]);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    page,
    setPage,
  ] =
    useState(1);

  const pageSize =
    10;

  const [
    total,
    setTotal,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    deleteId,
    setDeleteId,
  ] =
    useState<
      string | null
    >(null);

  const [
    detail,
    setDetail,
  ] =
    useState<
      Visit | null
    >(null);

  const loadVisits =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

          const params =
            new URLSearchParams({
              page:
                String(page),

              pageSize:
                String(pageSize),
            });

          if (
            search
          ) {
            params.set(
              "query",
              search,
            );
          }

          const result =
            await api<VisitPageResult>(
              `/api/visits?${params.toString()}`,
            );

          setVisits(
            result.visits,
          );

          setTotal(
            result.pagination.total,
          );
        } catch (
          cause
        ) {
          setError(
            getErrorMessage(
              cause,
              "Não foi possível carregar as visitas.",
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        page,
        search,
      ],
    );

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    const normalized =
      query.trim();

    if (
      normalized ===
      search
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          setPage(1);

          setSearch(
            normalized,
          );
        },
        300,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [
    query,
    search,
  ]);

  function updateField<
    K extends keyof VisitForm,
  >(
    field: K,
    value: VisitForm[K],
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      }),
    );
  }

  function resetForm() {
    setForm(
      initialForm,
    );

    setEditingId(
      null,
    );

    setFormVersion(
      (value) =>
        value + 1,
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const data =
      new FormData(
        event.currentTarget,
      );

    const scheduledDate =
      String(
        data.get(
          "scheduledDate",
        ) ?? "",
      );

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
      setError(
        "Preencha todos os campos obrigatórios.",
      );

      return;
    }

    if (
      form.endTime <=
      form.startTime
    ) {
      setError(
        "O horário final deve ser posterior ao horário inicial.",
      );

      return;
    }

    try {
      setBusy(true);

      const body = {
        type:
          form.type,

        subject:
          form.subject.trim(),

        description:
          form.description.trim() ||
          null,

        organization:
          form.organization.trim(),

        sector:
          form.sector.trim() ||
          null,

        scheduledDate,

        startTime:
          form.startTime,

        endTime:
          form.endTime,

        location:
          form.location,

        responsibleUnitId:
          null,

        responsibleAccountId:
          null,

        visitors: [
          {
            name:
              form.visitorName.trim(),

            position:
              form.visitorPosition.trim() ||
              null,

            organization:
              form.visitorOrganization.trim() ||
              form.organization.trim(),

            sector:
              form.visitorSector.trim() ||
              null,

            email:
              form.visitorEmail.trim() ||
              null,

            phone:
              form.visitorPhone.trim() ||
              null,

            cpf:
              form.visitorCpf.trim() ||
              null,
          },
        ],
      };

      if (
        editingId
      ) {
        await api(
          `/api/visits/${editingId}`,
          {
            method:
              "PATCH",

            body:
              json(body),
          },
        );

        setSuccess(
          "Visita atualizada com sucesso.",
        );
      } else {
        await api(
          "/api/visits",
          {
            method:
              "POST",

            body:
              json(body),
          },
        );

        setSuccess(
          "Visita cadastrada com sucesso.",
        );
      }

      resetForm();

      await loadVisits();
    } catch (
      cause
    ) {
      setError(
        getErrorMessage(
          cause,
          "Não foi possível salvar a visita.",
        ),
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function viewVisit(
    id: string,
  ) {
    try {
      const result =
        await api<Visit>(
          `/api/visits/${id}`,
        );

      setDetail(
        result,
      );
    } catch (
      cause
    ) {
      setError(
        getErrorMessage(
          cause,
          "Não foi possível consultar a visita.",
        ),
      );
    }
  }

  async function editVisit(
    id: string,
  ) {
    try {
      const visit =
        await api<Visit>(
          `/api/visits/${id}`,
        );

      const visitor =
        visit.visitors[0];

      setEditingId(id);

      setForm({
        type:
          visit.type,

        subject:
          visit.subject,

        description:
          visit.description ??
          "",

        organization:
          visit.organization,

        sector:
          visit.sector ??
          "",

        scheduledDate:
          visit.scheduledDate,

        startTime:
          visit.startTime.slice(
            0,
            5,
          ),

        endTime:
          visit.endTime.slice(
            0,
            5,
          ),

        location:
          visit.location,

        visitorName:
          visitor?.name ??
          "",

        visitorPosition:
          visitor?.position ??
          "",

        visitorOrganization:
          visitor?.organization ??
          "",

        visitorSector:
          visitor?.sector ??
          "",

        visitorEmail:
          visitor?.email ??
          "",

        visitorPhone:
          visitor?.phone ??
          "",

        visitorCpf:
          visitor?.cpf ??
          "",
      });

      setFormVersion(
        (value) =>
          value + 1,
      );

      window.scrollTo({
        top:
          0,

        behavior:
          "smooth",
      });
    } catch (
      cause
    ) {
      setError(
        getErrorMessage(
          cause,
          "Não foi possível carregar a visita.",
        ),
      );
    }
  }

  async function removeVisit() {
    if (
      !deleteId
    ) {
      return;
    }

    try {
      setBusy(true);

      await api(
        `/api/visits/${deleteId}`,
        {
          method:
            "DELETE",
        },
      );

      setDeleteId(
        null,
      );

      setSuccess(
        "Visita excluída com sucesso.",
      );

      await loadVisits();
    } catch (
      cause
    ) {
      setError(
        getErrorMessage(
          cause,
          "Não foi possível excluir a visita.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function releaseReception(
    id: string,
  ) {
    try {
      setBusy(true);

      await api(
        `/api/visits/${id}/release-reception`,
        {
          method:
            "POST",
        },
      );

      setSuccess(
        "Visita liberada para a recepção.",
      );

      await loadVisits();
    } catch (
      cause
    ) {
      setError(
        getErrorMessage(
          cause,
          "Não foi possível liberar a visita.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation(
    id: string,
  ) {
    try {
      setBusy(true);
      setError("");
      setSuccess("");

      await api(
        `/api/visits/${id}/send-confirmation`,
        {
          method:
            "POST",
        },
      );

      const updated =
        await api<Visit>(
          `/api/visits/${id}`,
        );

      setDetail(
        updated,
      );

      setSuccess(
        "E-mail de confirmação reenviado com sucesso.",
      );

      await loadVisits();
    } catch (
      cause
    ) {
      setError(
        getErrorMessage(
          cause,
          "Não foi possível reenviar a confirmação da visita.",
        ),
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="page-enter space-y-5 pb-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Agendamento de Visitas
        </p>

        <h1 className="mt-1 text-2xl font-extrabold md:text-[30px]">
          Nova visita
        </h1>

        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Cadastre e gerencie visitas,
          reuniões e atendimentos técnicos.
        </p>
      </div>

      {error ? (
        <Alert
          title="Erro"
          tone="danger"
        >
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert
          title="Operação concluída"
          tone="success"
        >
          {success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">
              {editingId
                ? "Editar agendamento"
                : "Cadastrar nova visita"}
            </h2>
          </div>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-6"
            onSubmit={
              submit
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                htmlFor="visit-type"
                label="Tipo da visita"
              >
                <select
                  id="visit-type"
                  required
                  className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  value={
                    form.type
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      "type",
                      event.target
                        .value as VisitType,
                    )
                  }
                >
                  {Object.entries(
                    visitTypeLabels,
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField
                htmlFor="visit-organization"
                label="Órgão / instituição"
              >
                <Input
                  id="visit-organization"
                  required
                  value={
                    form.organization
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      "organization",
                      event.target.value,
                    )
                  }
                />
              </FormField>

              <FormField
                htmlFor="visit-sector"
                label="Setor"
              >
                <Input
                  id="visit-sector"
                  value={
                    form.sector
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      "sector",
                      event.target.value,
                    )
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
                  value={
                    form.subject
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      "subject",
                      event.target.value,
                    )
                  }
                />
              </FormField>

              <FormField
                htmlFor="visit-date"
                label="Data"
              >
                <DatePicker
                  key={`${formVersion}-${form.scheduledDate}`}
                  id="visit-date"
                  name="scheduledDate"
                  required
                  defaultValue={
                    form.scheduledDate
                  }
                  placeholder="Selecione a data"
                />
              </FormField>

              {/* NOVO COMBOBOX */}

              <FormField
                htmlFor="visit-location"
                label="Sala da visita"
              >
                <select
                  id="visit-location"
                  required
                  className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  value={
                    form.location
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      "location",
                      event.target
                        .value as
                        | VisitLocation
                        | "",
                    )
                  }
                >
                  <option value="">
                    Selecione a sala
                  </option>

                  {visitLocationOptions.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField
                htmlFor="start-time"
                label="Hora inicial"
              >
                <Input
                  id="start-time"
                  required
                  type="time"
                  value={
                    form.startTime
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      "startTime",
                      event.target.value,
                    )
                  }
                />
              </FormField>

              <FormField
                htmlFor="end-time"
                label="Hora final"
              >
                <Input
                  id="end-time"
                  required
                  type="time"
                  value={
                    form.endTime
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      "endTime",
                      event.target.value,
                    )
                  }
                />
              </FormField>
            </div>

            <FormField
              htmlFor="description"
              label="Descrição / objetivo"
            >
              <textarea
                id="description"
                className="min-h-28 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
                value={
                  form.description
                }
                onChange={(
                  event,
                ) =>
                  updateField(
                    "description",
                    event.target.value,
                  )
                }
              />
            </FormField>

            <section className="border-t border-[var(--border)] pt-5">
              <h3 className="font-extrabold">
                Dados do visitante / técnico
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField
                  htmlFor="visitor-name"
                  label="Nome completo"
                >
                  <Input
                    id="visitor-name"
                    required
                    value={
                      form.visitorName
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        "visitorName",
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-position"
                  label="Cargo / função"
                >
                  <Input
                    id="visitor-position"
                    value={
                      form.visitorPosition
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        "visitorPosition",
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-organization"
                  label="Órgão do visitante"
                >
                  <Input
                    id="visitor-organization"
                    value={
                      form.visitorOrganization
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        "visitorOrganization",
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-sector"
                  label="Setor"
                >
                  <Input
                    id="visitor-sector"
                    value={
                      form.visitorSector
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        "visitorSector",
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-email"
                  label="E-mail"
                >
                  <Input
                    id="visitor-email"
                    type="email"
                    required
                    value={
                      form.visitorEmail
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        "visitorEmail",
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-phone"
                  label="Telefone"
                >
                  <Input
                    id="visitor-phone"
                    value={
                      form.visitorPhone
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        "visitorPhone",
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  htmlFor="visitor-cpf"
                  label="CPF"
                >
                  <Input
                    id="visitor-cpf"
                    value={
                      form.visitorCpf
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        "visitorCpf",
                        event.target.value,
                      )
                    }
                  />
                </FormField>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={
                    resetForm
                  }
                >
                  Cancelar edição
                </Button>
              ) : null}

              <Button
                type="submit"
                disabled={
                  busy
                }
              >
                <Plus size={16} />

                {editingId
                  ? "Salvar alterações"
                  : "Salvar visita"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* CONSULTA */}

      <Card>
        <CardHeader>
          <h2 className="font-extrabold">
            Consultar visitas
          </h2>
        </CardHeader>

        <CardContent>
          <div className="relative mb-5">
            <MagnifyingGlass
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2"
            />

            <Input
              className="pl-9"
              placeholder="Protocolo, órgão ou motivo"
              value={
                query
              }
              onChange={(
                event,
              ) =>
                setQuery(
                  event.target.value,
                )
              }
            />
          </div>

          {loading ? (
            <p className="py-10 text-center">
              Carregando...
            </p>
          ) : visits.length ===
            0 ? (
            <EmptyState
              title="Nenhuma visita encontrada"
              description="Os agendamentos aparecerão aqui."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <TableHead>
                      Protocolo
                    </TableHead>

                    <TableHead>
                      Data
                    </TableHead>

                    <TableHead>
                      Motivo
                    </TableHead>

                    <TableHead>
                      Sala
                    </TableHead>

                    <TableHead>
                      Status
                    </TableHead>

                    <TableHead>
                      Ações
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                  {visits.map(
                    (visit) => (
                      <TableRow
                        key={
                          visit.id
                        }
                      >
                        <TableCell>
                          {
                            visit.protocol
                          }
                        </TableCell>

                        <TableCell>
                          {formatDate(
                            visit.scheduledDate,
                          )}
                        </TableCell>

                        <TableCell>
                          {
                            visit.subject
                          }
                        </TableCell>

                        <TableCell>
                          {
                            visit.location
                          }
                        </TableCell>

                        <TableCell>
                          <Badge variant="neutral">
                            {
                              visitStatusLabels[
                                visit.status
                              ]
                            }
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void viewVisit(
                                  visit.id,
                                )
                              }
                            >
                              <Eye size={15} />
                              Consultar
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void editVisit(
                                  visit.id,
                                )
                              }
                            >
                              <PencilSimple size={15} />
                              Editar
                            </Button>

                            {[
                              "pending",
                              "approved",
                            ].includes(
                              visit.status,
                            ) ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void releaseReception(
                                    visit.id,
                                  )
                                }
                              >
                                <UserCheck size={15} />
                                Liberar
                              </Button>
                            ) : null}

                            {[
                              "pending",
                              "rejected",
                              "cancelled",
                            ].includes(
                              visit.status,
                            ) ? (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  setDeleteId(
                                    visit.id,
                                  )
                                }
                              >
                                <Trash size={15} />
                                Excluir
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </tbody>
              </Table>
            </div>
          )}

          <p className="mt-4 text-xs text-[var(--text-muted)]">
            {total} registro(s)
          </p>
        </CardContent>
      </Card>

      {deleteId ? (
        <ModalOverlay>
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h2 className="font-extrabold">
              Excluir visita?
            </h2>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  setDeleteId(null)
                }
              >
                Cancelar
              </Button>

              <Button
                variant="danger"
                onClick={() =>
                  void removeVisit()
                }
              >
                Excluir
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {detail ? (
        <ModalOverlay>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold">
                  Detalhes da visita
                </h2>

                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Consulte o agendamento e acompanhe a confirmação
                  enviada ao visitante.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setDetail(null)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem
                label="Protocolo"
                value={
                  detail.protocol
                }
              />

              <DetailItem
                label="Sala"
                value={
                  detail.location
                }
              />

              <DetailItem
                label="Órgão"
                value={
                  detail.organization
                }
              />

              <DetailItem
                label="Motivo"
                value={
                  detail.subject
                }
              />

              <DetailItem
                label="Data"
                value={
                  formatDate(
                    detail.scheduledDate,
                  )
                }
              />

              <DetailItem
                label="Horário"
                value={`${detail.startTime.slice(
                  0,
                  5,
                )} às ${detail.endTime.slice(
                  0,
                  5,
                )}`}
              />

              <DetailItem
                label="Situação"
                value={
                  visitStatusLabels[
                    detail.status
                  ] ?? detail.status
                }
              />

              <DetailItem
                label="Tipo"
                value={
                  visitTypeLabels[
                    detail.type
                  ] ?? detail.type
                }
              />
            </div>

            <section className="mt-6 border-t border-[var(--border)] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold">
                    Visitantes e confirmação
                  </h3>

                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    O status abaixo é atualizado quando o visitante
                    responde ao link recebido por e-mail.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    busy ||
                    !detail.visitors.some(
                      (visitor) =>
                        Boolean(
                          visitor.email?.trim(),
                        ),
                    )
                  }
                  onClick={() =>
                    void resendConfirmation(
                      detail.id,
                    )
                  }
                >
                  Reenviar confirmação
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {detail.visitors.map(
                  (visitor) => (
                    <div
                      key={
                        visitor.id
                      }
                      className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">
                            {
                              visitor.name
                            }
                          </p>

                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {visitor.position ??
                              "Cargo / função não informado"}
                          </p>
                        </div>

                        <Badge variant="neutral">
                          {
                            visitorConfirmationLabels[
                              visitor.confirmationStatus
                            ] ?? "NÃO INFORMADO"
                          }
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <DetailItem
                          label="E-mail"
                          value={
                            visitor.email ??
                            "Não informado"
                          }
                        />

                        <DetailItem
                          label="Telefone"
                          value={
                            visitor.phone ??
                            "Não informado"
                          }
                        />

                        <DetailItem
                          label="Órgão"
                          value={
                            visitor.organization
                          }
                        />

                        <DetailItem
                          label="Setor"
                          value={
                            visitor.sector ??
                            "Não informado"
                          }
                        />

                        <DetailItem
                          label="Convite enviado em"
                          value={
                            formatOptionalDateTime(
                              visitor.confirmationSentAt,
                            )
                          }
                        />

                        <DetailItem
                          label="Resposta recebida em"
                          value={
                            formatOptionalDateTime(
                              visitor.confirmationRespondedAt,
                            )
                          }
                        />

                        <DetailItem
                          label="Validade do convite"
                          value={
                            formatOptionalDateTime(
                              visitor.confirmationExpiresAt,
                            )
                          }
                        />

                        <DetailItem
                          label="Confirmação"
                          value={
                            visitorConfirmationLabels[
                              visitor.confirmationStatus
                            ] ?? "NÃO INFORMADO"
                          }
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setDetail(null)
                }
              >
                Fechar
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function ModalOverlay({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {children}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-[var(--text-faint)]">
        {label}
      </p>

      <p className="mt-1 text-sm">
        {value}
      </p>
    </div>
  );
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}

function formatOptionalDateTime(
  value:
    Date | string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle:
        "short",

      timeStyle:
        "short",
    },
  ).format(
    date,
  );
}

function getErrorMessage(
  cause: unknown,
  fallback: string,
) {
  return cause instanceof
    ApiError
    ? cause.message
    : fallback;
}