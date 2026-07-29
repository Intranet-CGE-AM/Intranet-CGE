import type {
  EmploymentCategory,
  OrganizationUnit,
  PeoplePageResult,
  PeopleImportResult,
  Person,
} from "@cge/contracts";
import {
  Alert,
  Avatar,
  AvatarPicker,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  Input,
  SearchableSelect,
  TableSkeleton,
  type ColumnDef,
} from "@cge/ui";
import {
  FileArrowUp as FileUp,
  GearSix as Settings2,
  MagnifyingGlass as Search,
  Plus,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { manausToday } from "../lib/dates";
import { can, canGlobally } from "../lib/permissions";
import {
  personInputFromForm,
  PersonFormFields,
} from "../modules/hr/person-form-fields";

export function PeoplePage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<EmploymentCategory[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [supervisorCandidates, setSupervisorCandidates] = useState<Person[]>(
    [],
  );
  const [supervisorQuery, setSupervisorQuery] = useState("");
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [supervisorLoading, setSupervisorLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [personDialog, setPersonDialog] = useState<Person | "new" | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<PeopleImportResult | null>(
    null,
  );
  const managesPeople = Boolean(user && can(user, "people.manage"));
  const managesPeopleGlobally = Boolean(
    user && canGlobally(user, "people.manage"),
  );
  const importsPeople = Boolean(user && canGlobally(user, "people.import"));
  const manageableUnits = units.filter(
    (unit) => user && can(user, "people.manage", unit.id),
  );
  const showsActions = managesPeople;
  const managedPerson =
    personDialog && personDialog !== "new" ? personDialog : null;

  const loadPeople = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError("");
        setDialogError("");
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.set("query", search);
        const result = await api<PeoplePageResult>(`/api/people?${params}`, {
          signal,
        });
        if (
          result.pagination.totalPages &&
          page > result.pagination.totalPages
        ) {
          setPage(result.pagination.totalPages);
          return;
        }
        setPeople(result.people);
        setTotal(result.pagination.total);
      } catch (cause) {
        if (isAbortError(cause)) return;
        setError(messageFor(cause, "Não foi possível carregar o diretório."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, search],
  );

  const loadReferenceData = useCallback(async () => {
    try {
      const [categoriesResult, unitsResult] = await Promise.all([
        api<{ categories: EmploymentCategory[] }>("/api/employment-categories"),
        api<{ units: OrganizationUnit[] }>("/api/organization-units"),
      ]);
      setCategories(categoriesResult.categories);
      setUnits(unitsResult.units);
    } catch (cause) {
      setError(
        messageFor(cause, "Não foi possível carregar categorias e unidades."),
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPeople(controller.signal);
    return () => controller.abort();
  }, [loadPeople]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    if (query.trim() === search) return;
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(query.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSupervisorSearch(supervisorQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [supervisorQuery]);

  useEffect(() => {
    if (!managedPerson) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ pageSize: "20" });
    if (supervisorSearch) params.set("query", supervisorSearch);
    setSupervisorLoading(true);
    setSupervisorCandidates([]);
    const currentSupervisor = managedPerson.employment?.supervisorRelationshipId
      ? api<PeoplePageResult>(
          `/api/people?${new URLSearchParams({
            employmentId: managedPerson.employment.supervisorRelationshipId,
            pageSize: "1",
          })}`,
          { signal: controller.signal },
        )
      : Promise.resolve(null);
    void Promise.all([
      api<PeoplePageResult>(`/api/people?${params}`, {
        signal: controller.signal,
      }),
      currentSupervisor,
    ])
      .then(([result, current]) => {
        const candidates = [
          ...(current?.people ?? []),
          ...result.people,
        ].filter((person) => person.id !== managedPerson.id);
        setSupervisorCandidates([
          ...new Map(candidates.map((person) => [person.id, person])).values(),
        ]);
      })
      .catch((cause) => {
        if (!isAbortError(cause)) {
          setDialogError(
            messageFor(cause, "Não foi possível pesquisar as chefias."),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSupervisorLoading(false);
      });
    return () => controller.abort();
  }, [managedPerson, supervisorSearch]);

  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const current = personDialog === "new" ? null : personDialog;
    try {
      setError("");
      setSuccess("");
      setBusy(true);
      await api(current ? `/api/people/${current.id}` : "/api/people", {
        method: current ? "PATCH" : "POST",
        body: json(personInputFromForm(data)),
      });
      setPersonDialog(null);
      await loadPeople();
      setSuccess(
        current ? "Colaborador atualizado." : "Colaborador cadastrado.",
      );
    } catch (cause) {
      setDialogError(
        messageFor(cause, "Não foi possível salvar o colaborador."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setDialogError("");
      setBusy(true);
      await api("/api/employment-categories", {
        method: "POST",
        body: json({
          name: data.get("name"),
          vacationEligible: data.get("vacationEligible") === "on",
        }),
      });
      form.reset();
      await loadReferenceData();
      setSuccess("Categoria adicionada.");
    } catch (cause) {
      setDialogError(messageFor(cause, "Não foi possível criar a categoria."));
    } finally {
      setBusy(false);
    }
  }

  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setDialogError("");
      setBusy(true);
      await api("/api/organization-units", {
        method: "POST",
        body: json({
          code: data.get("code"),
          name: data.get("name"),
          parentId: null,
        }),
      });
      form.reset();
      await loadReferenceData();
      setSuccess("Unidade adicionada.");
    } catch (cause) {
      setDialogError(messageFor(cause, "Não foi possível criar a unidade."));
    } finally {
      setBusy(false);
    }
  }

  async function runImport(mode: "preview" | "apply") {
    if (!importFile) return;
    try {
      setError("");
      setDialogError("");
      setSuccess("");
      setBusy(true);
      const result = await api<PeopleImportResult>("/api/imports/people", {
        method: "POST",
        body: json({
          filename: importFile.name,
          csv: await importFile.text(),
          mode,
        }),
      });
      setImportResult(result);
      if (mode === "apply") {
        await Promise.all([loadPeople(), loadReferenceData()]);
        setSuccess("Importação aplicada.");
      }
    } catch (cause) {
      setDialogError(messageFor(cause, "Não foi possível processar o CSV."));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(person: Person) {
    try {
      setDialogError("");
      setBusy(true);
      await api(`/api/people/${person.id}/deactivate`, {
        method: "POST",
        body: json({ endDate: manausToday() }),
      });
      await loadPeople();
      setPersonDialog(null);
      setSuccess("Vínculo e conta desativados.");
    } catch (cause) {
      setDialogError(
        messageFor(cause, "Não foi possível desativar o colaborador."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedPerson || !avatarFile) return;
    const body = new FormData();
    body.append("avatar", avatarFile);
    try {
      setBusy(true);
      setDialogError("");
      const result = await api<{ avatarUrl: string }>(
        `/api/people/${managedPerson.id}/avatar`,
        {
          method: "PUT",
          body,
        },
      );
      setPersonDialog({ ...managedPerson, avatarUrl: result.avatarUrl });
      setAvatarFile(null);
      await loadPeople();
      setSuccess("Foto do colaborador atualizada.");
    } catch (cause) {
      setDialogError(messageFor(cause, "Não foi possível salvar a foto."));
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (!managedPerson) return;
    try {
      setBusy(true);
      setDialogError("");
      await api(`/api/people/${managedPerson.id}/avatar`, { method: "DELETE" });
      setPersonDialog({ ...managedPerson, avatarUrl: null });
      setAvatarFile(null);
      await loadPeople();
      setSuccess("Foto do colaborador removida.");
    } catch (cause) {
      setDialogError(messageFor(cause, "Não foi possível remover a foto."));
    } finally {
      setBusy(false);
    }
  }

  const columns: ColumnDef<Person>[] = [
    {
      header: "Nome",
      cell: ({ row }) => {
        const person = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar
              name={person.preferredName ?? person.fullName}
              src={person.avatarUrl}
            />
            <div className="min-w-0">
              <p className="font-semibold">
                {person.preferredName ?? person.fullName}
              </p>
              {person.preferredName ? (
                <p className="text-xs text-[var(--text-faint)]">
                  {person.fullName}
                </p>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      header: "Unidade de lotação",
      cell: ({ row }) =>
        row.original.employment?.unitName ?? "Sem vínculo ativo",
    },
    {
      header: "Categoria funcional",
      cell: ({ row }) => (
        <span className="text-[var(--text-muted)]">
          {row.original.employment?.categoryName ?? "—"}
        </span>
      ),
    },
    {
      header: "Matrícula",
      cell: ({ row }) => (
        <Badge variant="neutral">
          {row.original.employment?.employeeNumber ?? "—"}
        </Badge>
      ),
    },
    ...(showsActions
      ? [
          {
            id: "actions",
            header: "Ações",
            cell: ({ row }) => {
              const person = row.original;
              if (
                !person.employment ||
                !user ||
                !can(user, "people.manage", person.employment.unitId)
              ) {
                return null;
              }
              const name = person.preferredName ?? person.fullName;
              return (
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label={`Gerenciar ${name}`}
                  onClick={() => {
                    setAvatarFile(null);
                    setSupervisorCandidates([]);
                    setSupervisorQuery("");
                    setSupervisorSearch("");
                    setDialogError("");
                    setPersonDialog(person);
                  }}
                >
                  Gerenciar
                </Button>
              );
            },
          } satisfies ColumnDef<Person>,
        ]
      : []),
  ];

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Colaboradores
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Diretório funcional respeitando o escopo da sua conta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {managesPeopleGlobally ? (
            <Button variant="quiet" onClick={() => setSettingsDialog(true)}>
              <Settings2 aria-hidden="true" size={16} />
              Categorias e unidades
            </Button>
          ) : null}
          {importsPeople ? (
            <Button variant="secondary" onClick={() => setImportDialog(true)}>
              <FileUp aria-hidden="true" size={16} />
              Importar CSV
            </Button>
          ) : null}
          {managesPeople ? (
            <Button onClick={() => setPersonDialog("new")}>
              <Plus aria-hidden="true" size={16} />
              Novo colaborador
            </Button>
          ) : null}
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
        <CardHeader className="flex-col items-stretch sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              size={16}
            />
            <Input
              type="search"
              aria-label="Buscar colaboradores"
              autoComplete="off"
              name="peopleSearch"
              placeholder="Nome, unidade ou categoria…"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </CardHeader>
        {loading ? (
          <TableSkeleton
            ariaLabel="Carregando diretório de colaboradores"
            headers={[
              "Nome",
              "Unidade de lotação",
              "Categoria funcional",
              "Matrícula",
              ...(showsActions ? ["Ações"] : []),
            ]}
            rows={Math.min(pageSize, 8)}
          />
        ) : total ? (
          <DataTable
            ariaLabel="Diretório de colaboradores"
            columns={columns}
            data={people}
            getRowId={(person) => person.id}
            itemLabel="colaboradores"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
            page={page}
            pageSize={pageSize}
            total={total}
          />
        ) : (
          <EmptyState
            title={query ? "Nenhum resultado" : "Diretório vazio"}
            description={
              query
                ? "Tente buscar por outro nome, unidade ou categoria."
                : "Nenhum colaborador está disponível nas unidades autorizadas para a sua conta. Se esperava ver alguém, solicite a revisão do seu perfil de acesso."
            }
          />
        )}
      </Card>

      <Dialog
        open={Boolean(personDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setPersonDialog(null);
            setAvatarFile(null);
            setSupervisorCandidates([]);
            setSupervisorQuery("");
            setSupervisorSearch("");
            setDialogError("");
          }
        }}
      >
        <DialogContent
          className={managedPerson ? "max-w-3xl" : "max-w-xl"}
          title={
            personDialog === "new"
              ? "Novo colaborador"
              : managedPerson
                ? `Gerenciar ${managedPerson.preferredName ?? managedPerson.fullName}`
                : "Gerenciar colaborador"
          }
          description={
            personDialog === "new"
              ? "Cadastre a pessoa e seu primeiro vínculo ativo."
              : "Centralize a foto, os dados funcionais, a chefia e a situação do vínculo."
          }
        >
          {dialogError ? (
            <Alert className="mb-5" title="Revise os dados" tone="danger">
              {dialogError}
            </Alert>
          ) : null}
          {managedPerson ? (
            <section className="border-b border-[var(--border)] pb-5">
              <div className="mb-4">
                <h3 className="font-bold">Foto e identificação</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  A foto aparece no diretório e nas áreas de identificação.
                </p>
              </div>
              <form
                className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
                onSubmit={saveAvatar}
              >
                <AvatarPicker
                  disabled={busy}
                  file={avatarFile}
                  id="personAvatar"
                  name={managedPerson.preferredName ?? managedPerson.fullName}
                  onFileChange={setAvatarFile}
                  src={managedPerson.avatarUrl}
                />
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {managedPerson.avatarUrl ? (
                    <ConfirmDialog
                      confirmLabel="Remover foto"
                      description={`A foto de ${managedPerson.preferredName ?? managedPerson.fullName} será removida do perfil.`}
                      onConfirm={removeAvatar}
                      title="Remover foto?"
                    >
                      <Button disabled={busy} type="button" variant="quiet">
                        Remover foto
                      </Button>
                    </ConfirmDialog>
                  ) : null}
                  <Button
                    disabled={!avatarFile || busy}
                    size="sm"
                    type="submit"
                  >
                    {busy ? "Salvando…" : "Salvar foto"}
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <section className={managedPerson ? "pt-5" : ""}>
            {managedPerson ? (
              <div className="mb-4">
                <h3 className="font-bold">Dados pessoais e vínculo</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Informações usadas no diretório e nos fluxos de Recursos
                  Humanos.
                </p>
              </div>
            ) : null}
            <form
              className="grid gap-4 sm:grid-cols-2"
              key={personDialog === "new" ? "new" : personDialog?.id}
              onSubmit={savePerson}
            >
              <PersonFormFields
                categories={categories}
                idPrefix="person"
                person={personDialog === "new" ? null : personDialog}
                units={manageableUnits}
              />
              {managedPerson ? (
                <FormField
                  className="sm:col-span-2"
                  hint="A chefia direta faz a primeira análise das solicitações de férias."
                  htmlFor="supervisorRelationshipId"
                  label="Chefia direta"
                >
                  <SearchableSelect
                    defaultValue={
                      managedPerson.employment?.supervisorRelationshipId ??
                      "no-supervisor"
                    }
                    id="supervisorRelationshipId"
                    name="supervisorRelationshipId"
                    onSearchChange={(value) => {
                      setSupervisorLoading(true);
                      setSupervisorCandidates([]);
                      setSupervisorQuery(value);
                    }}
                    options={[
                      {
                        label: "Sem chefia direta",
                        value: "no-supervisor",
                      },
                      ...supervisorCandidates
                        .filter((person) => person.employment)
                        .map((person) => ({
                          keywords: [
                            person.fullName,
                            person.employment?.unitName ?? "",
                          ],
                          label: `${person.preferredName ?? person.fullName} · ${person.employment?.unitName ?? "Sem unidade"}`,
                          value: person.employment?.id ?? "",
                        })),
                    ]}
                    placeholder="Pesquise por nome ou unidade"
                    searching={supervisorLoading}
                  />
                </FormField>
              ) : null}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => setPersonDialog(null)}
                >
                  Cancelar
                </Button>
                <Button disabled={busy} type="submit">
                  {busy
                    ? "Salvando…"
                    : personDialog === "new"
                      ? "Cadastrar"
                      : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </section>

          {managedPerson ? (
            <section className="mt-6 flex flex-col gap-4 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold">Situação do vínculo</h3>
                <p className="mt-1 max-w-xl text-xs text-[var(--text-muted)]">
                  A desativação encerra o vínculo ativo, desativa a conta
                  associada e revoga as sessões abertas.
                </p>
              </div>
              <ConfirmDialog
                confirmLabel="Desativar colaborador"
                description={`O vínculo e a conta de ${managedPerson.preferredName ?? managedPerson.fullName} serão desativados. As sessões abertas serão encerradas.`}
                onConfirm={() => deactivate(managedPerson)}
                title="Desativar colaborador?"
              >
                <Button disabled={busy} type="button" variant="danger">
                  Desativar vínculo e acesso
                </Button>
              </ConfirmDialog>
            </section>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={settingsDialog}
        onOpenChange={(open) => {
          setSettingsDialog(open);
          if (!open) setDialogError("");
        }}
      >
        <DialogContent
          title="Categorias e unidades"
          description="Cadastre as opções usadas no vínculo de cada colaborador."
          className="max-w-2xl"
        >
          {dialogError ? (
            <Alert className="mb-4" title="Revise os dados" tone="danger">
              {dialogError}
            </Alert>
          ) : null}
          {success ? (
            <Alert className="mb-4" title="Operação concluída" tone="success">
              {success}
            </Alert>
          ) : null}
          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h3 className="font-bold">Categorias funcionais</h3>
              {categories.length ? (
                <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
                  {categories.map((item) => (
                    <li
                      className="flex justify-between gap-3 py-2"
                      key={item.id}
                    >
                      <span>{item.name}</span>
                      <span className="text-xs text-[var(--text-faint)]">
                        {item.vacationEligible
                          ? "Férias habilitadas"
                          : "Sem fluxo de férias"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Nenhuma categoria cadastrada.
                </p>
              )}
              <form className="mt-4 space-y-3" onSubmit={createCategory}>
                <FormField
                  htmlFor="categoryName"
                  label="Nome da categoria"
                  hint="Ex.: Servidor efetivo"
                >
                  <Input
                    autoComplete="off"
                    id="categoryName"
                    name="name"
                    required
                    minLength={2}
                  />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    className="size-4"
                    name="vacationEligible"
                    type="checkbox"
                  />
                  Pode solicitar férias por este fluxo
                </label>
                <Button disabled={busy} type="submit" size="sm">
                  {busy ? "Cadastrando…" : "Cadastrar categoria"}
                </Button>
              </form>
            </section>
            <section>
              <h3 className="font-bold">Unidades de lotação</h3>
              {units.length ? (
                <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
                  {units.map((item) => (
                    <li className="py-2" key={item.id}>
                      <span className="font-semibold">{item.code}</span>
                      <span className="ml-2 text-[var(--text-muted)]">
                        {item.name}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Nenhuma unidade cadastrada.
                </p>
              )}
              <form className="mt-4 space-y-3" onSubmit={createUnit}>
                <FormField htmlFor="unitCode" label="Sigla da unidade">
                  <Input
                    autoComplete="off"
                    id="unitCode"
                    name="code"
                    required
                  />
                </FormField>
                <FormField htmlFor="unitName" label="Nome da unidade">
                  <Input
                    autoComplete="off"
                    id="unitName"
                    name="name"
                    required
                    minLength={2}
                  />
                </FormField>
                <Button disabled={busy} type="submit" size="sm">
                  {busy ? "Cadastrando…" : "Cadastrar unidade"}
                </Button>
              </form>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importDialog}
        onOpenChange={(open) => {
          setImportDialog(open);
          if (!open) setDialogError("");
        }}
      >
        <DialogContent
          title="Importar colaboradores"
          description="A validação mostra os erros sem alterar dados. A importação só é liberada depois da prévia."
        >
          <div className="space-y-4">
            {dialogError ? (
              <Alert title="Revise o arquivo" tone="danger">
                {dialogError}
              </Alert>
            ) : null}
            {success ? (
              <Alert title="Operação concluída" tone="success">
                {success}
              </Alert>
            ) : null}
            <Button asChild variant="quiet" size="sm">
              <a href="/modelo-importacao-colaboradores.csv" download>
                Baixar modelo CSV
              </a>
            </Button>
            <FormField htmlFor="peopleCsv" label="Arquivo CSV">
              <Input
                id="peopleCsv"
                name="peopleCsv"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setImportResult(null);
                }}
              />
            </FormField>
            {importResult ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-sm">
                <p className="font-bold">Resultado da validação</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  {importResult.successfulRows} válidas ·{" "}
                  {importResult.failedRows} com erro · {importResult.totalRows}{" "}
                  linhas
                </p>
                {importResult.rows.some((row) => row.errors.length) ? (
                  <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-[var(--danger)]">
                    {importResult.rows
                      .filter((row) => row.errors.length)
                      .map((row) => (
                        <li key={row.rowNumber}>
                          Linha {row.rowNumber}:{" "}
                          {row.errors.map((item) => item.message).join("; ")}
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={!importFile || busy}
                onClick={() => void runImport("preview")}
              >
                {busy ? "Validando…" : "Validar arquivo"}
              </Button>
              <Button
                disabled={
                  !importFile ||
                  !importResult ||
                  importResult.successfulRows === 0 ||
                  busy
                }
                onClick={() => void runImport("apply")}
              >
                {busy
                  ? "Aplicando…"
                  : importResult
                    ? `Aplicar ${importResult.successfulRows} ${
                        importResult.successfulRows === 1
                          ? "linha válida"
                          : "linhas válidas"
                      }`
                    : "Aplicar importação"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof ApiError ? cause.message : fallback;
}

function isAbortError(cause: unknown) {
  return cause instanceof DOMException && cause.name === "AbortError";
}
