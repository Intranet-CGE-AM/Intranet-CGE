import type {
  AdminUser,
  EmploymentCategory,
  OrganizationUnit,
  PermissionKey,
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
import { DownloadSimple, Plus, Question } from "@phosphor-icons/react";
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

type PermissionModule = "administration" | "people" | "vacations";

const permissionModule: Record<PermissionKey, PermissionModule> = {
  "access.manage": "administration",
  "accounts.manage": "administration",
  "audit.read": "administration",
  "audit.export": "administration",
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
    description: "Perfis, contas e auditoria",
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

const actionLabels: Record<string, string> = {
  "account.created": "Conta criada",
  "account.deactivated": "Conta desativada",
  "account.password-reset": "Senha redefinida",
  "auth.login": "Entrada na intranet",
  "auth.logout": "Saída da intranet",
  "auth.password-change": "Senha alterada",
  "people-import.apply": "Importação aplicada",
  "people-import.preview": "Importação validada",
  "people.created": "Pessoa cadastrada",
  "people.deactivated": "Pessoa desativada",
  "people.updated": "Pessoa atualizada",
  "person.avatar-deleted": "Foto removida",
  "person.avatar-updated": "Foto atualizada",
  "platform-admin.bootstrapped": "Administrador inicial criado",
  "role-assignment.created": "Acesso concedido",
  "role-assignment.deleted": "Acesso removido",
  "role.created": "Perfil criado",
  "role.updated": "Perfil atualizado",
  "vacation.cancelled": "Férias canceladas",
  "vacation.final-approved": "Férias aprovadas",
  "vacation.final-rejected": "Férias rejeitadas",
  "vacation.submitted": "Férias solicitadas",
  "vacation.supervisor-approved": "Chefia aprovou férias",
  "vacation.supervisor-rejected": "Chefia rejeitou férias",
};

const organizationScope = "organization";

const objectLabels: Record<string, string> = {
  account: "Conta de acesso",
  "homolog-fixture": "Cenário de homologação",
  "import-run": "Importação de pessoas",
  person: "Pessoa",
  role: "Perfil de acesso",
  "role-assignment": "Acesso concedido",
  "vacation-request": "Solicitação de férias",
};

type AdminSection = "accounts" | "access" | "audit";

type AuditEvent = {
  action: string;
  actorAccountId: string | null;
  createdAt: string;
  id: string;
  objectType: string;
  outcome: string;
};

export function AdminPage() {
  const { refresh, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<EmploymentCategory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const [userMode, setUserMode] = useState<"new" | "existing">("existing");
  const [roleDialog, setRoleDialog] = useState<Role | "new" | null>(null);
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [assignmentRoleId, setAssignmentRoleId] = useState("");
  const [passwordAccount, setPasswordAccount] = useState<AdminUser | null>(
    null,
  );
  const managesAccounts = Boolean(user && canGlobally(user, "accounts.manage"));
  const managesPeople = Boolean(
    user && can(user, "people.manage") && can(user, "people.read"),
  );
  const managesAccess = Boolean(user && canGlobally(user, "access.manage"));
  const readsAudit = Boolean(user && canGlobally(user, "audit.read"));
  const exportsAudit = Boolean(user && canGlobally(user, "audit.export"));
  const assignmentRole = roles.find((role) => role.id === assignmentRoleId);
  const assignmentCanBeScoped = Boolean(
    assignmentRole?.permissions.every(permissionSupportsUnitScope),
  );
  const manageableUnits = units.filter(
    (unit) => user && can(user, "people.manage", unit.id),
  );
  const hrReady = categories.length > 0 && manageableUnits.length > 0;
  const sections = [
    managesAccounts
      ? {
          key: "accounts" as const,
          label: "Contas",
          count: users.length,
        }
      : null,
    managesAccess
      ? {
          key: "access" as const,
          label: "Perfis e acessos",
          count: roles.length + assignments.length,
        }
      : null,
    readsAudit
      ? { key: "audit" as const, label: "Auditoria", count: events.length }
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
        unitsResult,
        auditResult,
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
        managesAccounts || managesAccess
          ? api<{ units: OrganizationUnit[] }>("/api/admin/organization-units")
          : Promise.resolve({ units: [] }),
        readsAudit
          ? api<{ events: AuditEvent[] }>("/api/audit-events?limit=20")
          : Promise.resolve({ events: [] }),
      ]);
      setUsers(usersResult.users);
      setPeople(peopleResult.people);
      setCategories(categoriesResult.categories);
      setRoles(rolesResult.roles);
      setAssignments(assignmentsResult.assignments);
      setUnits(unitsResult.units);
      setEvents(auditResult.events);
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível carregar a administração."));
    } finally {
      setLoading(false);
    }
  }, [managesAccess, managesAccounts, managesPeople, readsAudit]);

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
      if (userDialog || roleDialog || assignmentDialog || passwordAccount) {
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
    const data = new FormData(event.currentTarget);
    await mutate(async () => {
      await api("/api/admin/role-assignments", {
        method: "POST",
        body: json({
          accountId: data.get("accountId"),
          roleId: data.get("roleId"),
          unitId:
            data.get("unitId") === organizationScope
              ? null
              : data.get("unitId") || null,
        }),
      });
      setAssignmentDialog(false);
    }, "Acesso concedido.");
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
    if (
      !window.confirm(
        `Desativar a conta de ${account.person.displayName} e revogar suas sessões?`,
      )
    ) {
      return;
    }
    await mutate(async () => {
      await api(`/api/admin/users/${account.id}/deactivate`, {
        method: "POST",
      });
    }, "Conta desativada e sessões revogadas.");
  }

  async function removeAssignment(assignment: RoleAssignment, label: string) {
    if (!window.confirm(`Remover o acesso “${label}”?`)) return;
    await mutate(async () => {
      await api(`/api/admin/role-assignments/${assignment.id}`, {
        method: "DELETE",
      });
    }, "Acesso removido.");
  }

  if (!managesAccounts && !managesAccess && !readsAudit) {
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
          Pessoas com acesso, perfis por módulo e histórico da plataforma.
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

      {managesAccounts && section === "accounts" ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Contas de acesso</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Cadastre o colaborador e o acesso no mesmo fluxo.
              </p>
            </div>
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
                        {account.status === "active" ? (
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
                        {account.status === "active" &&
                        account.id !== user?.account.id ? (
                          <Button
                            disabled={busy}
                            size="sm"
                            variant="quiet"
                            onClick={() => void deactivate(account)}
                          >
                            Desativar
                          </Button>
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
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Perfis de acesso</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Combine permissões de um ou mais módulos.
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

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Acessos concedidos</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Uma pessoa pode acumular perfis em toda a organização ou por
                  unidade.
                </p>
              </div>
              <Button size="sm" onClick={() => setAssignmentDialog(true)}>
                <Plus aria-hidden="true" size={15} weight="bold" />
                Conceder acesso
              </Button>
            </CardHeader>
            {loading ? (
              <LoadingRows />
            ) : assignments.length ? (
              <div className="divide-y divide-[var(--border)]">
                {assignments.map((assignment) => {
                  const account = users.find(
                    (item) => item.id === assignment.accountId,
                  );
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
                      className="flex items-center gap-3 p-5"
                      key={assignment.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {account?.person.displayName ?? assignment.accountId}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {label}
                        </p>
                      </div>
                      <Button
                        disabled={busy}
                        size="sm"
                        variant="quiet"
                        onClick={() => void removeAssignment(assignment, label)}
                      >
                        Remover
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Nenhum acesso concedido"
                description="Escolha uma pessoa, um perfil e onde o acesso deve valer."
              />
            )}
          </Card>
        </div>
      ) : null}

      {readsAudit && section === "audit" ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Atividade de auditoria</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Últimos 20 eventos registrados pela plataforma.
              </p>
            </div>
            {exportsAudit ? (
              <Button asChild size="sm" variant="secondary">
                <a href="/api/audit-events/export" download>
                  <DownloadSimple aria-hidden="true" size={16} />
                  Exportar CSV
                </a>
              </Button>
            ) : null}
          </CardHeader>
          {loading ? (
            <LoadingRows />
          ) : events.length ? (
            <Table>
              <thead>
                <tr>
                  <TableHead>Evento</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Data</TableHead>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-semibold">
                      {actionLabels[event.action] ?? event.action}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {objectLabels[event.objectType] ?? event.objectType}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.outcome === "success" ? "success" : "danger"
                        }
                      >
                        {event.outcome === "success" ? "Sucesso" : "Falha"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--text-muted)]">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Manaus",
                      }).format(new Date(event.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              title="Sem atividade registrada"
              description="Eventos de autenticação e administração aparecerão aqui."
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
        open={assignmentDialog}
        onOpenChange={(open) => {
          setAssignmentDialog(open);
          if (!open) {
            setAssignmentRoleId("");
            setDialogError("");
          }
        }}
      >
        <DialogContent title="Conceder acesso">
          <form className="space-y-4" onSubmit={createAssignment}>
            {dialogError ? (
              <Alert title="Revise os dados" tone="danger">
                {dialogError}
              </Alert>
            ) : null}
            <FormField htmlFor="accountId" label="Pessoa">
              <SearchableSelect
                defaultValue=""
                id="accountId"
                name="accountId"
                options={users
                  .filter((account) => account.status === "active")
                  .map((account) => ({
                    keywords: [account.email],
                    label: account.person.displayName,
                    value: account.id,
                  }))}
                placeholder="Pesquise por nome ou e-mail"
                required
              />
            </FormField>
            <FormField htmlFor="roleId" label="Perfil de acesso">
              <Select
                id="roleId"
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
              htmlFor="unitId"
              label="Onde o acesso vale"
              hint={
                assignmentRole && !assignmentCanBeScoped
                  ? "Este perfil contém permissões que só podem valer para toda a organização."
                  : "Escolha toda a organização ou limite o acesso a uma unidade."
              }
            >
              <Select
                disabled={Boolean(assignmentRole && !assignmentCanBeScoped)}
                id="unitId"
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
                placeholder="Toda a organização"
              />
            </FormField>
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? "Concedendo…" : "Conceder acesso"}
            </Button>
          </form>
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
