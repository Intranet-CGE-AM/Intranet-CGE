import type {
  AdminUser,
  EmploymentCategory,
  OrganizationUnit,
  PermissionEffect,
  PermissionKey,
  PermissionOverride,
  Person,
  Role,
  RoleAssignment,
} from "@cge/contracts";
import { permissionKeys, permissionSupportsUnitScope } from "@cge/contracts";
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
  EmptyState,
  FormField,
  Input,
  SearchableSelect,
  Select,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@cge/ui/tooltip";
import { Plus, Question } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can, canGlobally } from "../lib/permissions";
import {
  personInputFromForm,
  PersonFormFields,
} from "../modules/hr/person-form-fields";

const permissionLabels: Record<PermissionKey, string> = {
  "access.manage": "Perfis e permissões",
  "accounts.manage": "Contas de acesso",
  "audit.read": "Consultar auditoria",
  "audit.export": "Exportar auditoria",
  "people.read": "Consultar pessoas",
  "people.manage": "Administrar pessoas",
  "people.import": "Importar pessoas",
  "birthdays.read": "Ver aniversários",
  "vacations.create": "Solicitar férias",
  "vacations.review.supervisor": "Decisão da chefia",
  "vacations.review.final": "Decisão final de férias",
};

const permissionDescriptions: Record<PermissionKey, string> = {
  "access.manage":
    "Cria e altera perfis de acesso, além de concedê-los às pessoas.",
  "accounts.manage": "Cria, desativa e redefine senhas das contas da intranet.",
  "audit.read": "Consulta o histórico recente de ações da plataforma.",
  "audit.export": "Baixa o histórico de auditoria em formato CSV.",
  "people.read": "Consulta colaboradores dentro das unidades autorizadas.",
  "people.manage":
    "Cadastra, altera e desativa pessoas, vínculos, chefias e lotações.",
  "people.import": "Valida e aplica importações de colaboradores por CSV.",
  "birthdays.read":
    "Vê nome, dia e mês de quem autorizou a exibição do aniversário.",
  "vacations.create": "Cria, envia e cancela solicitações próprias de férias.",
  "vacations.review.supervisor":
    "Analisa solicitações das pessoas vinculadas à chefia responsável.",
  "vacations.review.final":
    "Registra a decisão final após a aprovação da chefia.",
};

type PermissionModule = "administration" | "audit" | "people" | "vacations";

const permissionModule: Record<PermissionKey, PermissionModule> = {
  "access.manage": "administration",
  "accounts.manage": "administration",
  "audit.read": "audit",
  "audit.export": "audit",
  "people.read": "people",
  "people.manage": "people",
  "people.import": "people",
  "birthdays.read": "people",
  "vacations.create": "vacations",
  "vacations.review.supervisor": "vacations",
  "vacations.review.final": "vacations",
};

const permissionGroups = [
  {
    key: "administration",
    title: "Administração do sistema",
    description: "Perfis e contas da plataforma",
  },
  {
    key: "audit",
    title: "Auditoria",
    description: "Consulta e exportação dos registros",
  },
  {
    key: "people",
    title: "Pessoas e RH",
    description: "Diretório, cadastros e aniversários",
  },
  {
    key: "vacations",
    title: "Férias",
    description: "Solicitações e decisões",
  },
].map((group) => ({
  ...group,
  permissions: permissionKeys.filter(
    (permission) => permissionModule[permission] === group.key,
  ),
}));

const organizationScope = "organization";

type AdminSection = "accounts" | "access";

export function AdminPage() {
  const { refresh, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<EmploymentCategory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const [userMode, setUserMode] = useState<"new" | "existing">("existing");
  const [roleDialog, setRoleDialog] = useState<Role | "new" | null>(null);
  const [accessAccount, setAccessAccount] = useState<AdminUser | null>(null);
  const [assignmentRoleId, setAssignmentRoleId] = useState("");
  const [overridePermission, setOverridePermission] = useState<
    PermissionKey | ""
  >("");
  const [overrideEffect, setOverrideEffect] =
    useState<PermissionEffect>("allow");
  const [passwordAccount, setPasswordAccount] = useState<AdminUser | null>(
    null,
  );
  const managesAccounts = Boolean(user && canGlobally(user, "accounts.manage"));
  const managesPeople = Boolean(
    user && can(user, "people.manage") && can(user, "people.read"),
  );
  const managesAccess = Boolean(user && canGlobally(user, "access.manage"));
  const assignmentRole = roles.find((role) => role.id === assignmentRoleId);
  const assignmentCanBeScoped = Boolean(
    assignmentRole?.permissions.every(permissionSupportsUnitScope),
  );
  const overrideCanBeScoped =
    overrideEffect === "allow" &&
    Boolean(
      overridePermission &&
      permissionSupportsUnitScope(overridePermission as PermissionKey),
    );
  const manageableUnits = units.filter(
    (unit) => user && can(user, "people.manage", unit.id),
  );
  const hrReady = categories.length > 0 && manageableUnits.length > 0;
  const sections = [
    managesAccounts || managesAccess
      ? {
          key: "accounts" as const,
          label: "Pessoas e acessos",
          count: users.length,
        }
      : null,
    managesAccess
      ? {
          key: "access" as const,
          label: "Perfis",
          count: roles.length,
        }
      : null,
  ].filter(
    (
      section,
    ): section is {
      key: AdminSection;
      label: string;
      count: number;
    } => Boolean(section),
  );
  const requestedSection = searchParams.get("secao") as AdminSection | null;
  const section = sections.some((item) => item.key === requestedSection)
    ? requestedSection
    : sections[0]?.key;

  const load = useCallback(async () => {
    try {
      setError("");
      const [
        usersResult,
        peopleResult,
        categoriesResult,
        rolesResult,
        assignmentsResult,
        overridesResult,
        unitsResult,
      ] = await Promise.all([
        managesAccounts || managesAccess
          ? api<{ users: AdminUser[] }>("/api/admin/users")
          : Promise.resolve({ users: [] }),
        managesAccounts
          ? api<{ people: Person[] }>("/api/admin/people")
          : Promise.resolve({ people: [] }),
        managesPeople
          ? api<{ categories: EmploymentCategory[] }>(
              "/api/employment-categories",
            )
          : Promise.resolve({ categories: [] }),
        managesAccess
          ? api<{ roles: Role[] }>("/api/admin/roles")
          : Promise.resolve({ roles: [] }),
        managesAccess
          ? api<{ assignments: RoleAssignment[] }>(
              "/api/admin/role-assignments",
            )
          : Promise.resolve({ assignments: [] }),
        managesAccess
          ? api<{ overrides: PermissionOverride[] }>(
              "/api/admin/permission-overrides",
            )
          : Promise.resolve({ overrides: [] }),
        managesAccounts || managesAccess
          ? api<{ units: OrganizationUnit[] }>("/api/admin/organization-units")
          : Promise.resolve({ units: [] }),
      ]);
      setUsers(usersResult.users);
      setPeople(peopleResult.people);
      setCategories(categoriesResult.categories);
      setRoles(rolesResult.roles);
      setAssignments(assignmentsResult.assignments);
      setOverrides(overridesResult.overrides);
      setUnits(unitsResult.units);
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível carregar a administração."));
    } finally {
      setLoading(false);
    }
  }, [managesAccess, managesAccounts, managesPeople]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setDialogError("");
    setSuccess("");
    try {
      await action();
      try {
        await load();
      } finally {
        await refresh();
      }
      setSuccess(message);
    } catch (cause) {
      const message = messageFor(
        cause,
        "Não foi possível concluir a operação.",
      );
      if (userDialog || roleDialog || accessAccount || passwordAccount) {
        setDialogError(message);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate(
      async () => {
        const email = String(data.get("email")).trim().toLowerCase();
        if (users.some((account) => account.email.toLowerCase() === email)) {
          throw new ApiError(
            409,
            "EMAIL_ALREADY_IN_USE",
            "Já existe uma conta com este e-mail.",
          );
        }

        let personId = String(data.get("personId") ?? "");
        if (userMode === "new") {
          const created = await api<{ personId: string }>("/api/people", {
            method: "POST",
            body: json(personInputFromForm(data)),
          });
          personId = created.personId;
        }

        try {
          await api("/api/admin/users", {
            method: "POST",
            body: json({
              personId,
              email,
              temporaryPassword: data.get("temporaryPassword"),
            }),
          });
        } catch (cause) {
          if (userMode === "new") {
            await load();
            setUserMode("existing");
            throw new ApiError(
              cause instanceof ApiError ? cause.status : 500,
              "ACCOUNT_PROVISIONING_FAILED",
              "O colaborador foi cadastrado, mas o acesso não foi criado. Selecione a pessoa cadastrada e tente novamente.",
            );
          }
          throw cause;
        }
        setUserDialog(false);
      },
      userMode === "new"
        ? "Colaborador e conta de acesso criados."
        : "Conta criada. A senha deverá ser alterada no primeiro acesso.",
    );
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const current = roleDialog === "new" ? null : roleDialog;
    await mutate(
      async () => {
        await api(
          current ? `/api/admin/roles/${current.id}` : "/api/admin/roles",
          {
            method: current ? "PUT" : "POST",
            body: json({
              name: data.get("name"),
              description: data.get("description") || null,
              permissions: data.getAll("permissions"),
            }),
          },
        );
        setRoleDialog(null);
      },
      current ? "Perfil atualizado." : "Perfil criado.",
    );
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessAccount) return;
    const data = new FormData(event.currentTarget);
    await mutate(async () => {
      await api("/api/admin/role-assignments", {
        method: "POST",
        body: json({
          accountId: accessAccount.id,
          roleId: data.get("roleId"),
          unitId:
            data.get("unitId") === organizationScope
              ? null
              : data.get("unitId") || null,
        }),
      });
      setAssignmentRoleId("");
    }, "Acesso concedido.");
  }

  async function createOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessAccount || !overridePermission) return;
    const data = new FormData(event.currentTarget);
    await mutate(async () => {
      await api("/api/admin/permission-overrides", {
        method: "POST",
        body: json({
          accountId: accessAccount.id,
          permission: overridePermission,
          effect: overrideEffect,
          unitId:
            data.get("overrideUnitId") === organizationScope
              ? null
              : data.get("overrideUnitId") || null,
        }),
      });
      setOverridePermission("");
      setOverrideEffect("allow");
    }, "Ajuste individual aplicado.");
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordAccount) return;
    const account = passwordAccount;
    const data = new FormData(event.currentTarget);
    await mutate(async () => {
      await api(`/api/admin/users/${account.id}/password-reset`, {
        method: "POST",
        body: json({ temporaryPassword: data.get("temporaryPassword") }),
      });
      setPasswordAccount(null);
    }, `Senha de ${account.person.displayName} redefinida e sessões revogadas.`);
  }

  async function deactivate(account: AdminUser) {
    await mutate(async () => {
      await api(`/api/admin/users/${account.id}/deactivate`, {
        method: "POST",
      });
    }, "Conta desativada e sessões revogadas.");
  }

  async function removeAssignment(assignment: RoleAssignment) {
    await mutate(async () => {
      await api(`/api/admin/role-assignments/${assignment.id}`, {
        method: "DELETE",
      });
    }, "Acesso removido.");
  }

  async function removeOverride(override: PermissionOverride) {
    await mutate(async () => {
      await api(`/api/admin/permission-overrides/${override.id}`, {
        method: "DELETE",
      });
    }, "Ajuste individual removido.");
  }

  if (!managesAccounts && !managesAccess) {
    return (
      <Alert title="Acesso restrito" tone="danger">
        Sua conta não possui permissão de administração da plataforma.
      </Alert>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Plataforma
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
          Administração
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Contas, perfis reutilizáveis e ajustes individuais de acesso.
        </p>
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

      <nav
        aria-label="Seções da administração"
        className="flex gap-1 overflow-x-auto border-b border-[var(--border)]"
      >
        {sections.map((item) => (
          <Link
            aria-current={section === item.key ? "page" : undefined}
            className={[
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]",
              section === item.key
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
            ].join(" ")}
            key={item.key}
            to={`?secao=${item.key}`}
          >
            {item.label}
            <span className="text-xs tabular-nums text-[var(--text-faint)]">
              {item.count}
            </span>
          </Link>
        ))}
      </nav>

      {(managesAccounts || managesAccess) && section === "accounts" ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Contas de acesso</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Cada pessoa pode receber perfis e ajustes individuais.
              </p>
            </div>
            {managesAccounts ? (
              <Button
                size="sm"
                onClick={() => {
                  setUserMode(managesPeople ? "new" : "existing");
                  setUserDialog(true);
                }}
              >
                <Plus aria-hidden="true" size={15} weight="bold" />
                Novo acesso
              </Button>
            ) : null}
          </CardHeader>
          {loading ? (
            <LoadingRows />
          ) : users.length ? (
            <Table>
              <thead>
                <tr>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </tr>
              </thead>
              <tbody>
                {users.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <p className="font-semibold">
                        {account.person.displayName}
                      </p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {account.employment?.unitName ?? "Sem vínculo ativo"}
                      </p>
                    </TableCell>
                    <TableCell className="break-all">{account.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          account.status === "active" ? "success" : "neutral"
                        }
                      >
                        {account.status === "active" ? "Ativa" : "Desativada"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {managesAccess && account.status === "active" ? (
                          <Button
                            aria-label={`Gerenciar acessos de ${account.person.displayName}`}
                            disabled={busy}
                            size="sm"
                            variant="quiet"
                            onClick={() => {
                              setAssignmentRoleId("");
                              setOverridePermission("");
                              setOverrideEffect("allow");
                              setAccessAccount(account);
                            }}
                          >
                            Acessos
                          </Button>
                        ) : null}
                        {managesAccounts && account.status === "active" ? (
                          <Button
                            aria-label={`Redefinir senha de ${account.person.displayName}`}
                            disabled={busy}
                            size="sm"
                            variant="quiet"
                            onClick={() => setPasswordAccount(account)}
                          >
                            Redefinir senha
                          </Button>
                        ) : null}
                        {managesAccounts &&
                        account.status === "active" &&
                        account.id !== user?.account.id ? (
                          <ConfirmDialog
                            confirmLabel="Desativar conta"
                            description={`A conta de ${account.person.displayName} será desativada e todas as sessões abertas serão encerradas.`}
                            onConfirm={() => deactivate(account)}
                            title="Desativar conta?"
                          >
                            <Button disabled={busy} size="sm" variant="quiet">
                              Desativar
                            </Button>
                          </ConfirmDialog>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              title="Nenhuma conta"
              description="Crie a primeira conta para uma pessoa cadastrada."
            />
          )}
        </Card>
      ) : null}

      {managesAccess && section === "access" ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Perfis de acesso</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Crie conjuntos reutilizáveis. A atribuição é feita na conta de
                cada pessoa.
              </p>
            </div>
            <Button size="sm" onClick={() => setRoleDialog("new")}>
              <Plus aria-hidden="true" size={15} weight="bold" />
              Novo perfil
            </Button>
          </CardHeader>
          {loading ? (
            <LoadingRows />
          ) : roles.length ? (
            <div className="divide-y divide-[var(--border)]">
              {roles.map((role) => (
                <div className="p-5" key={role.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{role.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {role.description ?? "Sem descrição"}
                      </p>
                    </div>
                    <Button
                      aria-label={`Editar perfil ${role.name}`}
                      size="sm"
                      variant="quiet"
                      onClick={() => setRoleDialog(role)}
                    >
                      Editar
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {permissionGroups.map((group) => {
                      const permissions = group.permissions.filter(
                        (permission) => role.permissions.includes(permission),
                      );
                      return permissions.length ? (
                        <div key={group.key}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                            {group.title}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {permissions.map((permission) => (
                              <Badge key={permission}>
                                {permissionLabels[permission]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum perfil"
              description="Crie um perfil com as permissões necessárias."
            />
          )}
        </Card>
      ) : null}

      <Dialog
        open={userDialog}
        onOpenChange={(open) => {
          setUserDialog(open);
          if (!open) setDialogError("");
        }}
      >
        <DialogContent
          className="max-w-2xl"
          title="Novo acesso"
          description="Cadastre um colaborador ou vincule uma pessoa já existente."
        >
          <form className="space-y-6" onSubmit={createUser}>
            {dialogError ? (
              <Alert title="Revise os dados" tone="danger">
                {dialogError}
              </Alert>
            ) : null}

            {managesPeople ? (
              <div
                aria-label="Tipo de cadastro"
                className="grid grid-cols-2 rounded-[11px] bg-[var(--surface-subtle)] p-1"
                role="group"
              >
                {[
                  { label: "Novo colaborador", value: "new" as const },
                  { label: "Pessoa já cadastrada", value: "existing" as const },
                ].map((option) => (
                  <button
                    aria-pressed={userMode === option.value}
                    className={[
                      "min-h-10 rounded-[8px] px-3 text-sm font-semibold transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] active:scale-[0.98]",
                      userMode === option.value
                        ? "bg-white text-[var(--text)] shadow-[0_1px_2px_rgb(16_35_38/8%)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]",
                    ].join(" ")}
                    key={option.value}
                    onClick={() => setUserMode(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {userMode === "new" ? (
              <section>
                <h3 className="text-sm font-bold">Dados funcionais</h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Informações usadas pelo módulo de Recursos Humanos.
                </p>
                {!hrReady ? (
                  <Alert
                    className="mt-4"
                    title="Configuração de RH necessária"
                    tone="warning"
                  >
                    Cadastre ao menos uma categoria e uma unidade antes de
                    adicionar colaboradores.{" "}
                    <Link
                      className="font-semibold underline underline-offset-2"
                      to="/rh/colaboradores"
                    >
                      Abrir configuração de RH
                    </Link>
                  </Alert>
                ) : null}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <PersonFormFields
                    categories={categories}
                    idPrefix="onboarding"
                    units={manageableUnits}
                  />
                </div>
              </section>
            ) : (
              <FormField
                hint="Somente pessoas ainda sem conta de acesso."
                htmlFor="personId"
                label="Pessoa"
              >
                <SearchableSelect
                  defaultValue=""
                  id="personId"
                  name="personId"
                  options={people
                    .filter(
                      (person) =>
                        !users.some(
                          (account) => account.person.id === person.id,
                        ),
                    )
                    .map((person) => ({
                      keywords: [
                        person.fullName,
                        person.employment?.unitName ?? "",
                      ],
                      label: person.preferredName ?? person.fullName,
                      value: person.id,
                    }))}
                  placeholder="Pesquise por nome ou unidade"
                  required
                />
              </FormField>
            )}

            <section className="border-t border-[var(--border)] pt-5">
              <h3 className="text-sm font-bold">Conta de acesso</h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                A senha deverá ser alterada no primeiro acesso.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField htmlFor="accountEmail" label="E-mail institucional">
                  <Input
                    autoComplete="off"
                    id="accountEmail"
                    name="email"
                    spellCheck={false}
                    type="email"
                    required
                  />
                </FormField>
                <FormField
                  hint="Mínimo de 12 caracteres."
                  htmlFor="temporaryPassword"
                  label="Senha temporária"
                >
                  <Input
                    autoComplete="new-password"
                    id="temporaryPassword"
                    minLength={12}
                    name="temporaryPassword"
                    type="password"
                    required
                  />
                </FormField>
              </div>
            </section>
            <Button
              className="w-full"
              disabled={busy || (userMode === "new" && !hrReady)}
              type="submit"
            >
              {busy
                ? "Criando acesso…"
                : userMode === "new"
                  ? "Cadastrar colaborador e criar acesso"
                  : "Criar conta de acesso"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(roleDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setRoleDialog(null);
            setDialogError("");
          }
        }}
      >
        <DialogContent
          className="max-w-3xl"
          title={
            roleDialog === "new"
              ? "Novo perfil de acesso"
              : "Editar perfil de acesso"
          }
          description="As alterações passam a valer nas próximas requisições."
        >
          <form
            className="space-y-4"
            key={roleDialog === "new" ? "new" : roleDialog?.id}
            onSubmit={saveRole}
          >
            {dialogError ? (
              <Alert title="Revise os dados" tone="danger">
                {dialogError}
              </Alert>
            ) : null}
            <FormField htmlFor="roleName" label="Nome">
              <Input
                autoComplete="off"
                defaultValue={roleDialog === "new" ? "" : roleDialog?.name}
                id="roleName"
                name="name"
                required
              />
            </FormField>
            <FormField htmlFor="roleDescription" label="Descrição">
              <Input
                autoComplete="off"
                defaultValue={
                  roleDialog === "new" ? "" : (roleDialog?.description ?? "")
                }
                id="roleDescription"
                name="description"
              />
            </FormField>
            <fieldset>
              <legend className="text-sm font-semibold">Permissões</legend>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Combine acessos de módulos diferentes no mesmo perfil.
              </p>
              <TooltipProvider delayDuration={350}>
                <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {permissionGroups.map((group) => (
                    <section className="py-5" key={group.key}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                        <h3 className="text-sm font-extrabold tracking-[-0.015em]">
                          {group.title}
                        </h3>
                        <p className="text-xs leading-5 text-[var(--text-muted)]">
                          {group.description}
                        </p>
                      </div>
                      <div className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
                        {group.permissions.map((permission) => (
                          <div
                            className="grid min-h-14 grid-cols-[18px_minmax(0,1fr)_32px] items-start gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-[var(--surface-subtle)]"
                            key={permission}
                          >
                            <input
                              aria-describedby={`permission-scope-${permission}`}
                              className="mt-0.5 size-[18px] shrink-0 accent-[var(--brand)]"
                              defaultChecked={
                                roleDialog !== "new" &&
                                roleDialog?.permissions.includes(permission)
                              }
                              id={`permission-${permission}`}
                              name="permissions"
                              type="checkbox"
                              value={permission}
                            />
                            <div className="min-w-0">
                              <label
                                className="block cursor-pointer text-sm font-semibold leading-5"
                                htmlFor={`permission-${permission}`}
                              >
                                {permissionLabels[permission]}
                              </label>
                              <span
                                className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-faint)]"
                                id={`permission-scope-${permission}`}
                              >
                                {permissionSupportsUnitScope(permission)
                                  ? "Organização ou unidade"
                                  : "Somente organização"}
                              </span>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  aria-label={`Explicar permissão ${permissionLabels[permission]}`}
                                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--text-faint)] hover:bg-white hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]"
                                  type="button"
                                >
                                  <Question aria-hidden="true" size={15} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {permissionDescriptions[permission]}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </TooltipProvider>
            </fieldset>
            <Button className="w-full" disabled={busy} type="submit">
              {busy
                ? "Salvando…"
                : roleDialog === "new"
                  ? "Criar perfil"
                  : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(accessAccount)}
        onOpenChange={(open) => {
          if (!open) {
            setAccessAccount(null);
            setAssignmentRoleId("");
            setOverridePermission("");
            setOverrideEffect("allow");
            setDialogError("");
          }
        }}
      >
        <DialogContent
          className="max-w-3xl"
          title={
            accessAccount
              ? `Acessos de ${accessAccount.person.displayName}`
              : "Gerenciar acessos"
          }
          description="Perfis são a base reutilizável. Ajustes individuais concedem ou bloqueiam exceções para esta conta."
        >
          {dialogError ? (
            <Alert title="Revise os acessos" tone="danger">
              {dialogError}
            </Alert>
          ) : null}
          <div className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            <section className="py-5">
              <div>
                <h3 className="text-sm font-extrabold">Perfis atribuídos</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Use perfis para acessos que devem ser consistentes entre
                  várias pessoas.
                </p>
              </div>
              <div className="mt-3 divide-y divide-[var(--border)]">
                {assignments
                  .filter(
                    (assignment) => assignment.accountId === accessAccount?.id,
                  )
                  .map((assignment) => {
                    const role = roles.find(
                      (item) => item.id === assignment.roleId,
                    );
                    const unit = units.find(
                      (item) => item.id === assignment.unitId,
                    );
                    const label = `${role?.name ?? "Perfil"} · ${
                      unit?.name ?? "Toda a organização"
                    }`;
                    return (
                      <div
                        className="flex min-h-12 items-center gap-3 py-2"
                        key={assignment.id}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {role?.name ?? "Perfil removido"}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {unit?.name ?? "Toda a organização"}
                          </p>
                        </div>
                        <ConfirmDialog
                          confirmLabel="Remover perfil"
                          description={`O acesso “${label}” será removido desta pessoa. Ajustes individuais permanecerão ativos.`}
                          onConfirm={() => removeAssignment(assignment)}
                          title="Remover perfil?"
                        >
                          <Button disabled={busy} size="sm" variant="quiet">
                            Remover
                          </Button>
                        </ConfirmDialog>
                      </div>
                    );
                  })}
                {assignments.every(
                  (assignment) => assignment.accountId !== accessAccount?.id,
                ) ? (
                  <p className="py-3 text-xs text-[var(--text-muted)]">
                    Nenhum perfil atribuído.
                  </p>
                ) : null}
              </div>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                onSubmit={createAssignment}
              >
                <FormField htmlFor="accessRoleId" label="Adicionar perfil">
                  <Select
                    id="accessRoleId"
                    name="roleId"
                    onValueChange={setAssignmentRoleId}
                    options={roles.map((role) => ({
                      label: role.name,
                      value: role.id,
                    }))}
                    placeholder="Selecione o perfil"
                    required
                    value={assignmentRoleId}
                  />
                </FormField>
                <FormField
                  htmlFor="accessUnitId"
                  label="Escopo do perfil"
                  hint={
                    assignmentRole && !assignmentCanBeScoped
                      ? "Este perfil exige escopo organizacional."
                      : undefined
                  }
                >
                  <Select
                    defaultValue={organizationScope}
                    disabled={Boolean(assignmentRole && !assignmentCanBeScoped)}
                    id="accessUnitId"
                    name="unitId"
                    options={[
                      {
                        label: "Toda a organização",
                        value: organizationScope,
                      },
                      ...units.map((unit) => ({
                        label: `${unit.code} · ${unit.name}`,
                        value: unit.id,
                      })),
                    ]}
                  />
                </FormField>
                <Button disabled={busy} size="sm" type="submit">
                  Adicionar
                </Button>
              </form>
            </section>

            <section className="py-5">
              <div>
                <h3 className="text-sm font-extrabold">Ajustes individuais</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Exceções têm prioridade sobre os perfis. Bloqueios valem para
                  toda a organização.
                </p>
              </div>
              <div className="mt-3 divide-y divide-[var(--border)]">
                {overrides
                  .filter(
                    (override) => override.accountId === accessAccount?.id,
                  )
                  .map((override) => {
                    const unit = units.find(
                      (item) => item.id === override.unitId,
                    );
                    return (
                      <div
                        className="flex min-h-12 items-center gap-3 py-2"
                        key={override.id}
                      >
                        <Badge
                          variant={
                            override.effect === "allow" ? "success" : "danger"
                          }
                        >
                          {override.effect === "allow"
                            ? "Conceder"
                            : "Bloquear"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {permissionLabels[override.permission]}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {unit?.name ?? "Toda a organização"}
                          </p>
                        </div>
                        <Button
                          disabled={busy}
                          onClick={() => void removeOverride(override)}
                          size="sm"
                          type="button"
                          variant="quiet"
                        >
                          Remover
                        </Button>
                      </div>
                    );
                  })}
                {overrides.every(
                  (override) => override.accountId !== accessAccount?.id,
                ) ? (
                  <p className="py-3 text-xs text-[var(--text-muted)]">
                    Nenhum ajuste individual.
                  </p>
                ) : null}
              </div>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-2"
                onSubmit={createOverride}
              >
                <FormField
                  htmlFor="overridePermission"
                  label="Permissão específica"
                >
                  <Select
                    id="overridePermission"
                    name="overridePermission"
                    onValueChange={(value) =>
                      setOverridePermission(value as PermissionKey)
                    }
                    options={permissionGroups.flatMap((group) =>
                      group.permissions.map((permission) => ({
                        label: `${group.title} · ${permissionLabels[permission]}`,
                        value: permission,
                      })),
                    )}
                    placeholder="Selecione a permissão"
                    required
                    value={overridePermission}
                  />
                </FormField>
                <FormField htmlFor="overrideEffect" label="Tratamento">
                  <Select
                    id="overrideEffect"
                    name="overrideEffect"
                    onValueChange={(value) =>
                      setOverrideEffect(value as PermissionEffect)
                    }
                    options={[
                      { label: "Conceder acesso", value: "allow" },
                      { label: "Bloquear acesso", value: "deny" },
                    ]}
                    value={overrideEffect}
                  />
                </FormField>
                <FormField
                  htmlFor="overrideUnitId"
                  label="Escopo do ajuste"
                  hint={
                    overrideEffect === "deny"
                      ? "Bloqueios individuais valem em toda a organização."
                      : overridePermission && !overrideCanBeScoped
                        ? "Esta permissão exige escopo organizacional."
                        : undefined
                  }
                >
                  <Select
                    defaultValue={organizationScope}
                    disabled={!overrideCanBeScoped}
                    id="overrideUnitId"
                    name="overrideUnitId"
                    options={[
                      {
                        label: "Toda a organização",
                        value: organizationScope,
                      },
                      ...units.map((unit) => ({
                        label: `${unit.code} · ${unit.name}`,
                        value: unit.id,
                      })),
                    ]}
                  />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={busy || !overridePermission}
                    type="submit"
                  >
                    Aplicar ajuste
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordAccount)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordAccount(null);
            setDialogError("");
          }
        }}
      >
        <DialogContent
          title="Redefinir senha"
          description={
            passwordAccount
              ? `${passwordAccount.person.displayName} perderá todas as sessões ativas e deverá alterar a senha no próximo acesso.`
              : undefined
          }
        >
          <form className="space-y-4" onSubmit={resetPassword}>
            {dialogError ? (
              <Alert title="Revise os dados" tone="danger">
                {dialogError}
              </Alert>
            ) : null}
            <FormField
              htmlFor="resetTemporaryPassword"
              label="Nova senha temporária"
              hint="Mínimo de 12 caracteres."
            >
              <Input
                autoComplete="new-password"
                id="resetTemporaryPassword"
                minLength={12}
                name="temporaryPassword"
                type="password"
                required
              />
            </FormField>
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? "Redefinindo…" : "Redefinir senha"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingRows() {
  return (
    <CardContent className="space-y-3" aria-label="Carregando conteúdo">
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </CardContent>
  );
}

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof ApiError ? cause.message : fallback;
}
