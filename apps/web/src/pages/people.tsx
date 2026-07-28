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
import { FileUp, Plus, Search, Settings2, UsersRound } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [personDialog, setPersonDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<PeopleImportResult | null>(
    null,
  );
  const managesPeople = Boolean(user && can(user, "people.manage"));
  const importsPeople = Boolean(user && can(user, "people.import"));

  const load = useCallback(async () => {
    try {
      setError("");
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

  async function createPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setError("");
      await api("/api/people", {
        method: "POST",
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
      setPersonDialog(false);
      await load();
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível criar o colaborador."));
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/employment-categories", {
        method: "POST",
        body: json({
          name: data.get("name"),
          vacationEligible: data.get("vacationEligible") === "on",
        }),
      });
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível criar a categoria."));
    }
  }

  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/organization-units", {
        method: "POST",
        body: json({
          code: data.get("code"),
          name: data.get("name"),
          parentId: null,
        }),
      });
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível criar a unidade."));
    }
  }

  async function runImport(mode: "preview" | "apply") {
    if (!importFile) return;
    try {
      setError("");
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
      }
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível processar o CSV."));
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
      await api(`/api/people/${person.id}/deactivate`, {
        method: "POST",
        body: json({ endDate: manausToday() }),
      });
      await load();
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível desativar o colaborador."));
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
            <Button onClick={() => setPersonDialog(true)}>
              <Plus aria-hidden="true" size={16} />
              Novo colaborador
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert title="A operação não foi concluída">{error}</Alert>
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
              placeholder="Nome, unidade ou categoria"
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
                      <TableCell>
                        {person.employment ? (
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={() => void deactivate(person)}
                          >
                            Desativar
                          </Button>
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
            icon={<UsersRound aria-hidden="true" size={20} />}
            title={query ? "Nenhum resultado" : "Diretório vazio"}
            description={
              query
                ? "Tente buscar por outro nome, unidade ou categoria."
                : "Os colaboradores do seu escopo aparecerão aqui."
            }
          />
        )}
      </Card>

      <Dialog open={personDialog} onOpenChange={setPersonDialog}>
        <DialogContent
          title="Novo colaborador"
          description="Cadastre a pessoa e seu primeiro vínculo ativo."
          className="max-h-[90vh] overflow-y-auto"
        >
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={createPerson}>
            <FormField
              htmlFor="fullName"
              label="Nome completo"
              className="sm:col-span-2"
            >
              <Input id="fullName" name="fullName" required minLength={2} />
            </FormField>
            <FormField htmlFor="preferredName" label="Nome social ou preferido">
              <Input id="preferredName" name="preferredName" />
            </FormField>
            <FormField htmlFor="birthDate" label="Data de nascimento">
              <Input id="birthDate" name="birthDate" type="date" />
            </FormField>
            <FormField htmlFor="employeeNumber" label="Matrícula">
              <Input id="employeeNumber" name="employeeNumber" required />
            </FormField>
            <FormField htmlFor="startDate" label="Data de início">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={manausToday()}
                required
              />
            </FormField>
            <FormField htmlFor="categoryId" label="Categoria">
              <Select
                id="categoryId"
                name="categoryId"
                required
                defaultValue=""
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
              <Select id="unitId" name="unitId" required defaultValue="">
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
              <Input id="jobTitle" name="jobTitle" />
            </FormField>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input name="birthdayVisible" type="checkbox" />
              Autoriza exibição do aniversário (somente dia e mês)
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="quiet"
                onClick={() => setPersonDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Cadastrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent
          title="Configuração de RH"
          description="Categorias funcionais e unidades usadas nos vínculos."
          className="max-w-2xl"
        >
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
                  <Input id="categoryName" name="name" required minLength={2} />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <input name="vacationEligible" type="checkbox" />
                  Elegível ao fluxo de férias
                </label>
                <Button type="submit" size="sm">
                  Adicionar categoria
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
                  <Input id="unitCode" name="code" required />
                </FormField>
                <FormField htmlFor="unitName" label="Nome">
                  <Input id="unitName" name="name" required minLength={2} />
                </FormField>
                <Button type="submit" size="sm">
                  Adicionar unidade
                </Button>
              </form>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent
          title="Importar colaboradores"
          description="Valide o arquivo antes de aplicar qualquer alteração."
        >
          <div className="space-y-4">
            <FormField htmlFor="peopleCsv" label="Arquivo CSV">
              <Input
                id="peopleCsv"
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
                disabled={!importFile}
                onClick={() => void runImport("preview")}
              >
                Validar
              </Button>
              <Button
                disabled={!importFile || !importResult}
                onClick={() => void runImport("apply")}
              >
                Aplicar importação
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
