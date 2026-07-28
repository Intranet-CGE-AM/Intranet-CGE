import type {
  AdminUser,
  OrganizationUnit,
  PermissionKey,
  Person,
  Role,
  RoleAssignment,
} from "@cge/contracts";
import { permissionKeys } from "@cge/contracts";
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
  DownloadSimple,
  Key,
  PencilSimple,
  Plus,
  ShieldCheck,
  UserGear,
  UsersThree,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can } from "../lib/permissions";

const permissionLabels: Record<PermissionKey, string> = {
  "access.manage": "Papéis e permissões",
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

const actionLabels: Record<string, string> = {
  "account.created": "Conta criada",
  "account.deactivated": "Conta desativada",
  "account.password-reset": "Senha redefinida",
  "auth.login": "Entrada na intranet",
  "auth.logout": "Saída da intranet",
  "people-import.apply": "Importação aplicada",
  "people-import.preview": "Importação validada",
  "people.created": "Pessoa cadastrada",
  "people.deactivated": "Pessoa desativada",
  "people.updated": "Pessoa atualizada",
  "role-assignment.created": "Papel atribuído",
  "role-assignment.deleted": "Atribuição removida",
  "role.created": "Papel criado",
  "role.updated": "Papel atualizado",
  "vacation.cancelled": "Férias canceladas",
  "vacation.final-approved": "Férias aprovadas",
  "vacation.final-rejected": "Férias rejeitadas",
  "vacation.submitted": "Férias solicitadas",
  "vacation.supervisor-approved": "Chefia aprovou férias",
  "vacation.supervisor-rejected": "Chefia rejeitou férias",
};

type AuditEvent = {
  action: string;
  actorAccountId: string | null;
  createdAt: string;
  id: string;
  objectType: string;
  outcome: string;
};

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const [roleDialog, setRoleDialog] = useState<Role | "new" | null>(null);
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [passwordAccount, setPasswordAccount] = useState<AdminUser | null>(
    null,
  );
  const managesAccounts = Boolean(user && can(user, "accounts.manage"));
  const managesAccess = Boolean(user && can(user, "access.manage"));
  const readsAudit = Boolean(user && can(user, "audit.read"));
  const exportsAudit = Boolean(user && can(user, "audit.export"));

  const load = useCallback(async () => {
    try {
      setError("");
      const [
        usersResult,
        peopleResult,
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
      setRoles(rolesResult.roles);
      setAssignments(assignmentsResult.assignments);
      setUnits(unitsResult.units);
      setEvents(auditResult.events);
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível carregar a administração."));
    } finally {
      setLoading(false);
    }
  }, [managesAccess, managesAccounts, readsAudit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
      setSuccess(message);
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível concluir a operação."));
    } finally {
      setBusy(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate(async () => {
      await api("/api/admin/users", {
        method: "POST",
        body: json({
          personId: data.get("personId"),
          email: data.get("email"),
          temporaryPassword: data.get("temporaryPassword"),
        }),
      });
      setUserDialog(false);
    }, "Conta criada. A senha deverá ser alterada no primeiro acesso.");
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
      current ? "Papel atualizado." : "Papel criado.",
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
          unitId: data.get("unitId") || null,
        }),
      });
      setAssignmentDialog(false);
    }, "Papel atribuído à conta.");
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
    if (!window.confirm(`Remover a atribuição “${label}”?`)) return;
    await mutate(async () => {
      await api(`/api/admin/role-assignments/${assignment.id}`, {
        method: "DELETE",
      });
    }, "Atribuição removida.");
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
          Contas, papéis, escopos e rastreabilidade dos módulos.
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

      <dl className="grid divide-y divide-[var(--border)] border-y border-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { label: "Contas", value: users.length },
          { label: "Papéis", value: roles.length },
          { label: "Atribuições", value: assignments.length },
        ].map(({ label, value }) => (
          <div className="px-1 py-4 sm:px-5" key={label}>
            <dt className="text-xs font-semibold text-[var(--text-muted)]">
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {managesAccounts ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Contas de acesso</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Uma conta pertence a uma pessoa já cadastrada.
              </p>
            </div>
            <Button size="sm" onClick={() => setUserDialog(true)}>
              <Plus aria-hidden="true" size={15} weight="bold" />
              Nova conta
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
                            size="icon"
                            variant="quiet"
                            onClick={() => setPasswordAccount(account)}
                          >
                            <Key aria-hidden="true" size={17} />
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
              icon={<UsersThree aria-hidden="true" size={28} />}
              title="Nenhuma conta"
              description="Crie a primeira conta para uma pessoa cadastrada."
            />
          )}
        </Card>
      ) : null}

      {managesAccess ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Papéis</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Grupos editáveis do catálogo fixo de permissões.
                </p>
              </div>
              <Button size="sm" onClick={() => setRoleDialog("new")}>
                <Plus aria-hidden="true" size={15} weight="bold" />
                Novo papel
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
                        aria-label={`Editar papel ${role.name}`}
                        size="icon"
                        variant="quiet"
                        onClick={() => setRoleDialog(role)}
                      >
                        <PencilSimple aria-hidden="true" size={17} />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {role.permissions.map((permission) => (
                        <Badge key={permission}>
                          {permissionLabels[permission]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ShieldCheck aria-hidden="true" size={28} />}
                title="Nenhum papel"
                description="Crie um papel com as permissões necessárias."
              />
            )}
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Atribuições</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Uma conta pode acumular papéis globais e por unidade.
                </p>
              </div>
              <Button size="sm" onClick={() => setAssignmentDialog(true)}>
                <Plus aria-hidden="true" size={15} weight="bold" />
                Atribuir
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
                  const label = `${role?.name ?? "Papel"} · ${
                    unit?.name ?? "Escopo global"
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
                icon={<UserGear aria-hidden="true" size={28} />}
                title="Nenhuma atribuição"
                description="Atribua um papel a uma conta e defina seu escopo."
              />
            )}
          </Card>
        </div>
      ) : null}

      {readsAudit ? (
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
                      {event.objectType}
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
              icon={<ShieldCheck aria-hidden="true" size={28} />}
              title="Sem atividade registrada"
              description="Eventos de autenticação e administração aparecerão aqui."
            />
          )}
        </Card>
      ) : null}

      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent
          title="Nova conta"
          description="A pessoa receberá uma senha temporária e deverá alterá-la no primeiro acesso."
        >
          <form className="space-y-4" onSubmit={createUser}>
            <FormField htmlFor="personId" label="Pessoa">
              <Select autoComplete="off" id="personId" name="personId" required>
                <option value="">Selecione</option>
                {people
                  .filter(
                    (person) =>
                      !users.some((account) => account.person.id === person.id),
                  )
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.preferredName ?? person.fullName}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField htmlFor="accountEmail" label="E-mail">
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
              htmlFor="temporaryPassword"
              label="Senha temporária"
              hint="Mínimo de 12 caracteres."
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
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? "Criando conta…" : "Criar conta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(roleDialog)}
        onOpenChange={(open) => !open && setRoleDialog(null)}
      >
        <DialogContent
          title={roleDialog === "new" ? "Novo papel" : "Editar papel"}
          description="As alterações passam a valer nas próximas requisições."
        >
          <form
            className="space-y-4"
            key={roleDialog === "new" ? "new" : roleDialog?.id}
            onSubmit={saveRole}
          >
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
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {permissionKeys.map((permission) => (
                  <label
                    className="flex min-h-11 items-start gap-2 rounded-[10px] border border-[var(--border)] p-2 text-xs hover:bg-[var(--surface-subtle)]"
                    key={permission}
                  >
                    <input
                      className="mt-0.5 size-4"
                      defaultChecked={
                        roleDialog !== "new" &&
                        roleDialog?.permissions.includes(permission)
                      }
                      name="permissions"
                      type="checkbox"
                      value={permission}
                    />
                    {permissionLabels[permission]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button className="w-full" disabled={busy} type="submit">
              {busy
                ? "Salvando…"
                : roleDialog === "new"
                  ? "Criar papel"
                  : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentDialog} onOpenChange={setAssignmentDialog}>
        <DialogContent title="Atribuir papel">
          <form className="space-y-4" onSubmit={createAssignment}>
            <FormField htmlFor="accountId" label="Conta">
              <Select
                autoComplete="off"
                id="accountId"
                name="accountId"
                required
              >
                <option value="">Selecione</option>
                {users
                  .filter((account) => account.status === "active")
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.person.displayName}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField htmlFor="roleId" label="Papel">
              <Select autoComplete="off" id="roleId" name="roleId" required>
                <option value="">Selecione</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              htmlFor="unitId"
              label="Escopo"
              hint="Sem unidade significa acesso global."
            >
              <Select autoComplete="off" id="unitId" name="unitId">
                <option value="">Global</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? "Atribuindo…" : "Atribuir papel"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordAccount)}
        onOpenChange={(open) => !open && setPasswordAccount(null)}
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
