import type {
  EmploymentCategory,
  OrganizationUnit,
  PeopleImportResult,
  Person,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import {
  FileArrowUp as FileUp,
  GearSix as Settings2,
  MagnifyingGlass as Search,
  PencilSimple,
  Plus,
  TreeStructure,
  UserMinus,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can } from "../lib/permissions";

export function PeoplePage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<EmploymentCategory[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [personDialog, setPersonDialog] = useState<Person | "new" | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [supervisorPerson, setSupervisorPerson] = useState<Person | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<PeopleImportResult | null>(
    null,
  );
  const managesPeople = Boolean(user && can(user, "people.manage"));
  const importsPeople = Boolean(user && can(user, "people.import"));

  const load = useCallback(async () => {
    try {
      setError("");
      setDialogError("");
      const [peopleResult, categoriesResult, unitsResult] = await Promise.all([
        api<{ people: Person[] }>("/api/people"),
        api<{ categories: EmploymentCategory[] }>("/api/employment-categories"),
        api<{ units: OrganizationUnit[] }>("/api/organization-units"),
      ]);
      setPeople(peopleResult.people);
      setCategories(categoriesResult.categories);
      setUnits(unitsResult.units);
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível carregar o diretório."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return people;
    return people.filter((person) =>
      [
        person.preferredName,
        person.fullName,
        person.employment?.unitName,
        person.employment?.categoryName,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [people, query]);

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
        body: json({
          fullName: data.get("fullName"),
          preferredName: data.get("preferredName") || null,
          birthDate: data.get("birthDate") || null,
          birthdayVisible: data.get("birthdayVisible") === "on",
          employment: {
            employeeNumber: data.get("employeeNumber"),
            categoryId: data.get("categoryId"),
            unitId: data.get("unitId"),
            startDate: data.get("startDate"),
            jobTitle: data.get("jobTitle") || null,
          },
        }),
      });
      setPersonDialog(null);
      await load();
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
      await load();
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
      await load();
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
        await load();
        setSuccess("Importação aplicada.");
      }
    } catch (cause) {
      setDialogError(messageFor(cause, "Não foi possível processar o CSV."));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(person: Person) {
    if (
      !window.confirm(
        `Desativar o vínculo e a conta de ${person.preferredName ?? person.fullName}?`,
      )
    ) {
      return;
    }
    try {
      setDialogError("");
      setBusy(true);
      await api(`/api/people/${person.id}/deactivate`, {
        method: "POST",
        body: json({ endDate: manausToday() }),
      });
      await load();
      setSuccess("Vínculo e conta desativados.");
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível desativar o colaborador."));
    } finally {
      setBusy(false);
    }
  }

  async function assignSupervisor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supervisorPerson) return;
    const data = new FormData(event.currentTarget);
    try {
      setBusy(true);
      await api(`/api/people/${supervisorPerson.id}`, {
        method: "PATCH",
        body: json({
          employment: {
            supervisorRelationshipId: data.get("supervisorRelationshipId"),
          },
        }),
      });
      setSupervisorPerson(null);
      await load();
      setSuccess("Chefia direta atualizada.");
    } catch (cause) {
      setDialogError(messageFor(cause, "Não foi possível definir a chefia."));
    } finally {
      setBusy(false);
    }
  }

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
          {managesPeople ? (
            <Button variant="quiet" onClick={() => setSettingsDialog(true)}>
              <Settings2 aria-hidden="true" size={16} />
              Configurar RH
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
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </CardContent>
        ) : filtered.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Matrícula</TableHead>
                  {managesPeople ? <TableHead>Ação</TableHead> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <p className="font-semibold">
                        {person.preferredName ?? person.fullName}
                      </p>
                      {person.preferredName ? (
                        <p className="text-xs text-[var(--text-faint)]">
                          {person.fullName}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {person.employment?.unitName ?? "Sem vínculo ativo"}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {person.employment?.categoryName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">
                        {person.employment?.employeeNumber ?? "—"}
                      </Badge>
                    </TableCell>
                    {managesPeople ? (
                      <TableCell className="whitespace-nowrap">
                        {person.employment ? (
                          <div className="flex gap-1">
                            <Button
                              variant="quiet"
                              size="icon"
                              aria-label={`Editar ${person.preferredName ?? person.fullName}`}
                              title="Editar colaborador"
                              onClick={() => setPersonDialog(person)}
                            >
                              <PencilSimple aria-hidden="true" size={17} />
                            </Button>
                            <Button
                              variant="quiet"
                              size="icon"
                              aria-label={`Definir chefia de ${person.preferredName ?? person.fullName}`}
                              title="Definir chefia"
                              disabled={busy}
                              onClick={() => setSupervisorPerson(person)}
                            >
                              <TreeStructure aria-hidden="true" size={17} />
                            </Button>
                            <Button
                              variant="quiet"
                              size="icon"
                              aria-label={`Desativar ${person.preferredName ?? person.fullName}`}
                              title="Desativar vínculo"
                              disabled={busy}
                              onClick={() => void deactivate(person)}
                            >
                              <UserMinus aria-hidden="true" size={17} />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </tbody>
            </Table>
            <CardContent className="border-t border-[var(--border)] py-3 text-xs text-[var(--text-faint)]">
              {filtered.length} de {people.length} colaboradores visíveis
            </CardContent>
          </>
        ) : (
          <EmptyState
            title={query ? "Nenhum resultado" : "Diretório vazio"}
            description={
              query
                ? "Tente buscar por outro nome, unidade ou categoria."
                : "Os colaboradores do seu escopo aparecerão aqui."
            }
          />
        )}
      </Card>

      <Dialog
        open={Boolean(personDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setPersonDialog(null);
            setDialogError("");
          }
        }}
      >
        <DialogContent
          title={
            personDialog === "new" ? "Novo colaborador" : "Editar colaborador"
          }
          description={
            personDialog === "new"
              ? "Cadastre a pessoa e seu primeiro vínculo ativo."
              : "Atualize os dados pessoais e do vínculo ativo."
          }
        >
          <form
            className="grid gap-4 sm:grid-cols-2"
            key={personDialog === "new" ? "new" : personDialog?.id}
            onSubmit={savePerson}
          >
            {dialogError ? (
              <Alert
                className="sm:col-span-2"
                title="Revise os dados"
                tone="danger"
              >
                {dialogError}
              </Alert>
            ) : null}
            <FormField
              htmlFor="fullName"
              label="Nome completo"
              className="sm:col-span-2"
            >
              <Input
                autoComplete="off"
                defaultValue={
                  personDialog === "new" ? "" : personDialog?.fullName
                }
                id="fullName"
                name="fullName"
                required
                minLength={2}
              />
            </FormField>
            <FormField htmlFor="preferredName" label="Nome social ou preferido">
              <Input
                autoComplete="off"
                defaultValue={
                  personDialog === "new"
                    ? ""
                    : (personDialog?.preferredName ?? "")
                }
                id="preferredName"
                name="preferredName"
              />
            </FormField>
            <FormField htmlFor="birthDate" label="Data de nascimento">
              <Input
                defaultValue={
                  personDialog === "new" ? "" : (personDialog?.birthDate ?? "")
                }
                id="birthDate"
                name="birthDate"
                type="date"
              />
            </FormField>
            <FormField htmlFor="employeeNumber" label="Matrícula">
              <Input
                autoComplete="off"
                defaultValue={
                  personDialog === "new"
                    ? ""
                    : (personDialog?.employment?.employeeNumber ?? "")
                }
                id="employeeNumber"
                name="employeeNumber"
                required
              />
            </FormField>
            <FormField htmlFor="startDate" label="Data de início">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={
                  personDialog === "new"
                    ? manausToday()
                    : personDialog?.employment?.startDate
                }
                required
              />
            </FormField>
            <FormField htmlFor="categoryId" label="Categoria">
              <Select
                id="categoryId"
                name="categoryId"
                required
                defaultValue={
                  personDialog === "new"
                    ? ""
                    : personDialog?.employment?.categoryId
                }
              >
                <option value="" disabled>
                  Selecione
                </option>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField htmlFor="unitId" label="Unidade">
              <Select
                id="unitId"
                name="unitId"
                required
                defaultValue={
                  personDialog === "new" ? "" : personDialog?.employment?.unitId
                }
              >
                <option value="" disabled>
                  Selecione
                </option>
                {units.map((unit) => (
                  <option value={unit.id} key={unit.id}>
                    {unit.code} — {unit.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              htmlFor="jobTitle"
              label="Cargo"
              className="sm:col-span-2"
            >
              <Input
                autoComplete="off"
                defaultValue={
                  personDialog === "new"
                    ? ""
                    : (personDialog?.employment?.jobTitle ?? "")
                }
                id="jobTitle"
                name="jobTitle"
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                className="size-4"
                defaultChecked={
                  personDialog === "new" ? false : personDialog?.birthdayVisible
                }
                name="birthdayVisible"
                type="checkbox"
              />
              Autoriza exibição do aniversário (somente dia e mês)
            </label>
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
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(supervisorPerson)}
        onOpenChange={() => {
          setSupervisorPerson(null);
          setDialogError("");
        }}
      >
        <DialogContent
          title="Definir chefia"
          description={
            supervisorPerson
              ? `Selecione a chefia direta de ${supervisorPerson.preferredName ?? supervisorPerson.fullName}.`
              : undefined
          }
        >
          <form className="space-y-4" onSubmit={assignSupervisor}>
            {dialogError ? (
              <Alert title="Revise os dados" tone="danger">
                {dialogError}
              </Alert>
            ) : null}
            <FormField htmlFor="supervisorRelationshipId" label="Chefia direta">
              <Select
                id="supervisorRelationshipId"
                name="supervisorRelationshipId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {people
                  .filter(
                    (person) =>
                      person.id !== supervisorPerson?.id && person.employment,
                  )
                  .map((person) => (
                    <option key={person.id} value={person.employment?.id ?? ""}>
                      {person.preferredName ?? person.fullName}
                    </option>
                  ))}
              </Select>
            </FormField>
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? "Salvando…" : "Salvar chefia"}
            </Button>
          </form>
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
          title="Configuração de RH"
          description="Categorias funcionais e unidades usadas nos vínculos."
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
              <h3 className="font-bold">Categorias</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {categories.length
                  ? categories.map((item) => item.name).join(", ")
                  : "Nenhuma categoria cadastrada."}
              </p>
              <form className="mt-4 space-y-3" onSubmit={createCategory}>
                <FormField htmlFor="categoryName" label="Nome">
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
                  Elegível ao fluxo de férias
                </label>
                <Button disabled={busy} type="submit" size="sm">
                  {busy ? "Adicionando…" : "Adicionar categoria"}
                </Button>
              </form>
            </section>
            <section>
              <h3 className="font-bold">Unidades</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {units.length
                  ? units.map((item) => item.code).join(", ")
                  : "Nenhuma unidade cadastrada."}
              </p>
              <form className="mt-4 space-y-3" onSubmit={createUnit}>
                <FormField htmlFor="unitCode" label="Sigla">
                  <Input
                    autoComplete="off"
                    id="unitCode"
                    name="code"
                    required
                  />
                </FormField>
                <FormField htmlFor="unitName" label="Nome">
                  <Input
                    autoComplete="off"
                    id="unitName"
                    name="name"
                    required
                    minLength={2}
                  />
                </FormField>
                <Button disabled={busy} type="submit" size="sm">
                  {busy ? "Adicionando…" : "Adicionar unidade"}
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
          description="Valide o arquivo antes de aplicar qualquer alteração."
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
                {busy ? "Validando…" : "Validar"}
              </Button>
              <Button
                disabled={!importFile || !importResult || busy}
                onClick={() => void runImport("apply")}
              >
                {busy ? "Aplicando…" : "Aplicar importação"}
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

function manausToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
