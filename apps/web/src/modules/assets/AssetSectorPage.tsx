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
  Table,
  TableCell,
  TableHead,
  TableRow,
  TableSkeleton,
} from "@cge/ui";

import {
  CheckCircle,
  PencilSimple,
  PlusCircle,
  Prohibit,
} from "@phosphor-icons/react";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import { api, ApiError, json } from "../../lib/api";

import {
  type OrganizationUnit,
  type OrganizationUnitType,
  type OrganizationUnitsResponse,
  PageHeader,
  unitOptions,
} from "./shared";

type UnitForm = {
  code: string;
  name: string;
  type: OrganizationUnitType;
  parentId: string;
  departmentId: string;
};

type FieldErrors = Partial<
  Record<"code" | "name" | "department" | "parent", string>
>;

const emptyForm: UnitForm = {
  code: "",
  name: "",
  type: "department",
  parentId: "",
  departmentId: "",
};

const typeOptions = [
  { label: "Departamento", value: "department" },
  { label: "Setor", value: "sector" },
  { label: "Subsetor", value: "subsector" },
];

function getUnitTypeLabel(type: OrganizationUnitType | null) {
  return (
    typeOptions.find((option) => option.value === type)?.label ?? "Não definido"
  );
}

function ParentUnitFields({
  form,
  units,
  errors,
  onChange,
}: {
  form: UnitForm;
  units: OrganizationUnit[];
  errors: FieldErrors;
  onChange: (patch: Partial<UnitForm>) => void;
}) {
  if (form.type === "department") {
    return null;
  }

  const departments = units.filter(
    (unit) => unit.type === "department" && unit.active,
  );

  if (form.type === "sector") {
    return (
      <FormField
        label="Departamento"
        htmlFor="parent-department"
        error={errors.parent}
      >
        <SearchableSelect
          id="parent-department"
          name="parentId"
          required
          aria-invalid={Boolean(errors.parent)}
          options={unitOptions(departments)}
          value={form.parentId}
          onValueChange={(parentId) => onChange({ parentId })}
          placeholder="Selecione..."
        />
      </FormField>
    );
  }

  const sectors = units.filter(
    (unit) =>
      unit.type === "sector" &&
      unit.active &&
      (!form.departmentId || unit.parentId === form.departmentId),
  );

  return (
    <>
      <FormField
        label="Departamento"
        htmlFor="subsector-department"
        error={errors.department}
      >
        <SearchableSelect
          id="subsector-department"
          name="departmentId"
          required
          aria-invalid={Boolean(errors.department)}
          options={unitOptions(departments)}
          value={form.departmentId}
          onValueChange={(departmentId) =>
            onChange({ departmentId, parentId: "" })
          }
          placeholder="Selecione..."
        />
      </FormField>

      <FormField label="Setor" htmlFor="parent-sector" error={errors.parent}>
        <SearchableSelect
          id="parent-sector"
          name="parentId"
          required
          aria-invalid={Boolean(errors.parent)}
          disabled={!form.departmentId}
          options={unitOptions(sectors)}
          value={form.parentId}
          onValueChange={(parentId) => onChange({ parentId })}
          placeholder={
            form.departmentId
              ? "Selecione..."
              : "Selecione primeiro o departamento"
          }
        />
      </FormField>
    </>
  );
}

export function AssetSectorPage() {
  const [units, setUnits] = useState<OrganizationUnit[]>([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingUnit, setEditingUnit] = useState<OrganizationUnit | null>(null);

  const [form, setForm] = useState<UnitForm>(emptyForm);

  const [dialogError, setDialogError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const loadUnits = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await api<OrganizationUnitsResponse>(
        "/api/organization-units",
      );

      setUnits(result.units);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível carregar as unidades organizacionais.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  function updateForm(patch: Partial<UnitForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setFieldErrors({});
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingUnit(null);
    setForm(emptyForm);
    setDialogError("");
    setFieldErrors({});
  }

  function startCreate() {
    setEditingUnit(null);
    setForm(emptyForm);
    setDialogError("");
    setFieldErrors({});
    setSuccess("");
    setDialogOpen(true);
  }

  function startEdit(unit: OrganizationUnit) {
    if (!unit.type) {
      setError(
        "Esta unidade ainda não possui um tipo organizacional definido.",
      );

      return;
    }

    const parentSector =
      unit.type === "subsector" && unit.parentId
        ? units.find((item) => item.id === unit.parentId)
        : undefined;

    setEditingUnit(unit);
    setForm({
      code: unit.code,
      name: unit.name,
      type: unit.type,
      parentId: unit.parentId ?? "",
      departmentId: parentSector?.parentId ?? "",
    });
    setDialogError("");
    setFieldErrors({});
    setError("");
    setSuccess("");
    setDialogOpen(true);
  }

  function validate() {
    const errors: FieldErrors = {};
    let message = "";

    if (!form.code.trim() || !form.name.trim()) {
      message = "Informe o código e o nome da unidade organizacional.";
      if (!form.code.trim()) errors.code = "Informe o código.";
      if (!form.name.trim()) errors.name = "Informe o nome.";
    } else if (form.type === "subsector" && !form.departmentId) {
      message = "Selecione o departamento ao qual o subsetor pertence.";
      errors.department = "Selecione o departamento.";
    } else if (form.type !== "department" && !form.parentId) {
      message =
        form.type === "sector"
          ? "Selecione o departamento ao qual o setor pertence."
          : "Selecione o setor ao qual o subsetor pertence.";
      errors.parent =
        form.type === "sector"
          ? "Selecione o departamento."
          : "Selecione o setor.";
    }

    setFieldErrors(errors);
    setDialogError(message);

    return !message;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      setDialogError("");
      setSuccess("");

      await api(
        editingUnit
          ? `/api/organization-units/${editingUnit.id}`
          : "/api/organization-units",
        {
          method: editingUnit ? "PATCH" : "POST",

          body: json({
            code: form.code.trim(),
            name: form.name.trim(),
            type: form.type,
            parentId: form.type === "department" ? null : form.parentId || null,
          }),
        },
      );

      const wasEditing = Boolean(editingUnit);

      closeDialog();

      setSuccess(
        wasEditing
          ? "Unidade organizacional atualizada com sucesso."
          : "Unidade organizacional cadastrada com sucesso.",
      );

      await loadUnits();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setDialogError(cause.message);
      } else {
        setDialogError(
          editingUnit
            ? "Não foi possível atualizar a unidade organizacional."
            : "Não foi possível cadastrar a unidade organizacional.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(unit: OrganizationUnit) {
    const newActive = !unit.active;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(`/api/organization-units/${unit.id}/active`, {
        method: "PATCH",

        body: json({
          active: newActive,
        }),
      });

      setSuccess(
        newActive
          ? "Unidade organizacional ativada com sucesso."
          : "Unidade organizacional inativada com sucesso.",
      );

      await loadUnits();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError(
          newActive
            ? "Não foi possível ativar a unidade organizacional."
            : "Não foi possível inativar a unidade organizacional.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function getParentLabel(unit: OrganizationUnit) {
    const parent = units.find((item) => item.id === unit.parentId);

    return parent ? `${parent.code} - ${parent.name}` : "—";
  }

  const term = query.trim().toLowerCase();

  const visibleUnits = term
    ? units.filter(
        (unit) =>
          unit.code.toLowerCase().includes(term) ||
          unit.name.toLowerCase().includes(term),
      )
    : units;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Estrutura organizacional"
        description="Cadastre e consulte departamentos, setores e subsetores disponíveis para localização dos bens patrimoniais."
        actions={
          <Button type="button" onClick={startCreate}>
            <PlusCircle aria-hidden="true" size={16} />
            Nova unidade
          </Button>
        }
      />

      {error ? (
        <Alert tone="danger" title="Não foi possível concluir a operação">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert tone="success" title="Operação concluída">
          {success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Unidades organizacionais cadastradas</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Departamentos, setores e subsetores disponíveis para utilização no
              cadastro dos bens.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {units.length > 0 ? (
            <Input
              type="search"
              aria-label="Buscar por código ou nome"
              placeholder="Buscar por código ou nome"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}

          {loading ? (
            <TableSkeleton
              ariaLabel="Carregando unidades organizacionais"
              headers={[
                "Código",
                "Nome",
                "Tipo",
                "Vinculado a",
                "Situação",
                "Ações",
              ]}
            />
          ) : visibleUnits.length === 0 ? (
            <EmptyState
              title={
                units.length === 0
                  ? "Nenhuma unidade organizacional cadastrada"
                  : "Nenhuma unidade encontrada"
              }
              description={
                units.length === 0
                  ? "Cadastre a primeira unidade para usá-la na localização dos bens."
                  : "Nenhuma unidade corresponde à busca."
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TableHead>Código</TableHead>

                  <TableHead>Nome</TableHead>

                  <TableHead>Tipo</TableHead>

                  <TableHead>Vinculado a</TableHead>

                  <TableHead>Situação</TableHead>

                  <TableHead>Ações</TableHead>
                </tr>
              </thead>

              <tbody>
                {visibleUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <span className="font-bold">{unit.code}</span>
                    </TableCell>

                    <TableCell>{unit.name}</TableCell>

                    <TableCell>{getUnitTypeLabel(unit.type)}</TableCell>

                    <TableCell>{getParentLabel(unit)}</TableCell>

                    <TableCell>
                      <Badge variant={unit.active ? "success" : "neutral"}>
                        {unit.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="quiet"
                          disabled={saving}
                          onClick={() => startEdit(unit)}
                        >
                          <PencilSimple aria-hidden="true" size={16} />
                          Editar
                        </Button>

                        {unit.active ? (
                          <ConfirmDialog
                            title="Inativar unidade?"
                            description={`A unidade ${unit.code} - ${unit.name} deixará de estar disponível para novos cadastros e movimentações de bens.`}
                            confirmLabel="Inativar"
                            onConfirm={() => handleToggleActive(unit)}
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant="quiet"
                              disabled={saving}
                            >
                              <Prohibit aria-hidden="true" size={16} />
                              Inativar
                            </Button>
                          </ConfirmDialog>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="quiet"
                            disabled={saving}
                            onClick={() => void handleToggleActive(unit)}
                          >
                            <CheckCircle aria-hidden="true" size={16} />
                            Ativar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !saving) closeDialog();
        }}
      >
        <DialogContent
          title={
            editingUnit
              ? "Editar unidade organizacional"
              : "Nova unidade organizacional"
          }
          description={
            editingUnit
              ? "Atualize os dados da unidade organizacional."
              : "Informe o tipo, o código e o nome da unidade organizacional."
          }
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            {dialogError ? (
              <Alert tone="danger" title="Revise os dados informados">
                {dialogError}
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Tipo" htmlFor="unit-type">
                <Select
                  id="unit-type"
                  name="type"
                  required
                  options={typeOptions}
                  value={form.type}
                  onValueChange={(type) => {
                    updateForm({
                      type: type as OrganizationUnitType,
                      parentId: "",
                      departmentId: "",
                    });
                  }}
                />
              </FormField>

              <FormField label="Código" htmlFor="code" error={fieldErrors.code}>
                <Input
                  id="code"
                  name="code"
                  required
                  aria-invalid={Boolean(fieldErrors.code)}
                  value={form.code}
                  onChange={(event) => updateForm({ code: event.target.value })}
                  placeholder="Ex.: DAF"
                />
              </FormField>

              <FormField
                label="Nome da unidade"
                htmlFor="name"
                error={fieldErrors.name}
                className="sm:col-span-2"
              >
                <Input
                  id="name"
                  name="name"
                  required
                  aria-invalid={Boolean(fieldErrors.name)}
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  placeholder="Ex.: Diretoria Administrativa e Financeira"
                />
              </FormField>

              <ParentUnitFields
                form={form}
                units={units}
                errors={fieldErrors}
                onChange={updateForm}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={closeDialog}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingUnit ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
