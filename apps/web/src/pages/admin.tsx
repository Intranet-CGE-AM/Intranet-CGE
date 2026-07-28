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
  FormField,
  Input,
  Select,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import {
  Key as KeyRound,
  Plus,
  ShieldCheck,
  UserGear as UserRoundCog,
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

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [error, setError] = useState("");
  const [userDialog, setUserDialog] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const managesAccounts = Boolean(user && can(user, "accounts.manage"));
  const managesAccess = Boolean(user && can(user, "access.manage"));

  const load = useCallback(async () => {
    try {
      setError("");
      const [
        usersResult,
        peopleResult,
        rolesResult,
        assignmentsResult,
        unitsResult,
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
      ]);
      setUsers(usersResult.users);
      setPeople(peopleResult.people);
      setRoles(rolesResult.roles);
      setAssignments(assignmentsResult.assignments);
      setUnits(unitsResult.units);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar a administração.",
      );
    }
  }, [managesAccess, managesAccounts]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api("/api/admin/users", {
      method: "POST",
      body: json({
        personId: data.get("personId"),
        email: data.get("email"),
        temporaryPassword: data.get("temporaryPassword"),
      }),
    });
    setUserDialog(false);
    await load();
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api("/api/admin/roles", {
      method: "POST",
      body: json({
        name: data.get("name"),
        description: data.get("description") || null,
        permissions: data.getAll("permissions"),
      }),
    });
    setRoleDialog(false);
    await load();
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api("/api/admin/role-assignments", {
      method: "POST",
      body: json({
        accountId: data.get("accountId"),
        roleId: data.get("roleId"),
        unitId: data.get("unitId") || null,
      }),
    });
    setAssignmentDialog(false);
    await load();
  }

  async function deactivate(accountId: string) {
    await api(`/api/admin/users/${accountId}/deactivate`, { method: "POST" });
    await load();
  }

  async function removeAssignment(id: string) {
    await api(`/api/admin/role-assignments/${id}`, { method: "DELETE" });
    await load();
  }

  if (!managesAccounts && !managesAccess) {
    return (
      <Alert title="Acesso restrito">
        Sua conta não possui permissão de administração da plataforma.
      </Alert>
    );
  }

  return (
    <div className="page-enter space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Plataforma
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
          Administração
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Contas, papéis e permissões compartilhados por todos os módulos.
        </p>
      </div>

      {error ? <Alert title="Não foi possível carregar">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: UserRoundCog, label: "Contas", value: users.length },
          { icon: ShieldCheck, label: "Papéis", value: roles.length },
          { icon: KeyRound, label: "Atribuições", value: assignments.length },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <Icon aria-hidden="true" size={19} />
              </span>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  {label}
                </p>
                <p className="text-2xl font-extrabold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {managesAccounts ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Contas de acesso</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Uma conta pertence a uma pessoa já cadastrada.
              </p>
            </div>
            <Button size="sm" onClick={() => setUserDialog(true)}>
              <Plus aria-hidden="true" size={15} />
              Nova conta
            </Button>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <TableHead>Pessoa</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Ação</TableHead>
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
                  <TableCell>{account.email}</TableCell>
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
                    {account.status === "active" &&
                    account.id !== user?.account.id ? (
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => void deactivate(account.id)}
                      >
                        Desativar
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {managesAccess ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Papéis</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Grupos editáveis do catálogo fixo de permissões.
                </p>
              </div>
              <Button size="sm" onClick={() => setRoleDialog(true)}>
                <Plus aria-hidden="true" size={15} />
                Novo papel
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {roles.map((role) => (
                <div
                  className="rounded-xl border border-[var(--border)] p-4"
                  key={role.id}
                >
                  <p className="font-bold">{role.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {role.description ?? "Sem descrição"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {role.permissions.map((permission) => (
                      <Badge key={permission}>
                        {permissionLabels[permission]}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Atribuições</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Uma conta pode acumular papéis globais e por unidade.
                </p>
              </div>
              <Button size="sm" onClick={() => setAssignmentDialog(true)}>
                <Plus aria-hidden="true" size={15} />
                Atribuir
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
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
                return (
                  <div
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4"
                    key={assignment.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {account?.person.displayName ?? assignment.accountId}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {role?.name ?? assignment.roleId} ·{" "}
                        {unit?.name ?? "Escopo global"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => void removeAssignment(assignment.id)}
                    >
                      Remover
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent
          title="Nova conta"
          description="A pessoa receberá uma senha temporária e deverá alterá-la no primeiro acesso."
        >
          <form className="space-y-4" onSubmit={createUser}>
            <FormField htmlFor="personId" label="Pessoa">
              <Select id="personId" name="personId" required>
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
            <FormField htmlFor="email" label="E-mail">
              <Input id="email" name="email" type="email" required />
            </FormField>
            <FormField
              htmlFor="temporaryPassword"
              label="Senha temporária"
              hint="Mínimo de 12 caracteres."
            >
              <Input
                id="temporaryPassword"
                name="temporaryPassword"
                type="password"
                minLength={12}
                required
              />
            </FormField>
            <Button className="w-full" type="submit">
              Criar conta
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent title="Novo papel">
          <form className="space-y-4" onSubmit={createRole}>
            <FormField htmlFor="name" label="Nome">
              <Input id="name" name="name" required />
            </FormField>
            <FormField htmlFor="description" label="Descrição">
              <Input id="description" name="description" />
            </FormField>
            <fieldset>
              <legend className="text-sm font-semibold">Permissões</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {permissionKeys.map((permission) => (
                  <label
                    className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-2 text-xs"
                    key={permission}
                  >
                    <input
                      className="mt-0.5"
                      name="permissions"
                      type="checkbox"
                      value={permission}
                    />
                    {permissionLabels[permission]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button className="w-full" type="submit">
              Criar papel
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentDialog} onOpenChange={setAssignmentDialog}>
        <DialogContent title="Atribuir papel">
          <form className="space-y-4" onSubmit={createAssignment}>
            <FormField htmlFor="accountId" label="Conta">
              <Select id="accountId" name="accountId" required>
                <option value="">Selecione</option>
                {users.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.person.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField htmlFor="roleId" label="Papel">
              <Select id="roleId" name="roleId" required>
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
              hint="Sem unidade = papel global."
            >
              <Select id="unitId" name="unitId">
                <option value="">Global</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button className="w-full" type="submit">
              Atribuir papel
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
