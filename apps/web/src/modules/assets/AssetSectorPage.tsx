import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormField,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";

import {
  CheckCircle,
  PencilSimple,
  PlusCircle,
  Prohibit,
} from "@phosphor-icons/react";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  api,
  ApiError,
  json,
} from "../../lib/api";

type OrganizationUnitType =
  | "department"
  | "sector"
  | "subsector";

type OrganizationUnit = {
  id: string;
  code: string;
  name: string;
  type: OrganizationUnitType | null;
  parentId: string | null;
  active: boolean;
};

type OrganizationUnitsResponse = {
  units: OrganizationUnit[];
};

export function AssetSectorPage() {
  const [
    units,
    setUnits,
  ] = useState<
    OrganizationUnit[]
  >([]);

  const [
    code,
    setCode,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

    const [
    unitType,
    setUnitType,
  ] = useState<OrganizationUnitType>(
    "department",
  );

  const [
    parentId,
    setParentId,
  ] = useState("");


  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    editingUnit,
    setEditingUnit,
  ] =
    useState<OrganizationUnit | null>(
      null,
    );

  const [
    editCode,
    setEditCode,
  ] = useState("");

  const [
    editName,
    setEditName,
  ] = useState("");

  const loadUnits =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const result =
            await api<OrganizationUnitsResponse>(
              "/api/organization-units",
            );

          setUnits(
            result.units,
          );
        } catch (cause) {
          if (
            cause instanceof
            ApiError
          ) {
            setError(
              cause.message,
            );
          } else {
            setError(
              "Não foi possível carregar os setores.",
            );
          }
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !code.trim() ||
      !name.trim()
    ) {
      setError(
        "Informe o código e o nome do setor.",
      );

      return;
    }

    if (
      unitType !== "department" &&
      !parentId
    ) {
      setError(
        unitType === "sector"
          ? "Selecione o departamento ao qual o setor pertence."
          : "Selecione o setor ao qual o subsetor pertence.",
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        "/api/organization-units",
        {
          method: "POST",

          body: json({
          code: code.trim(),
          name: name.trim(),
          type: unitType,
          parentId:
            unitType === "department"
              ? null
              : parentId || null,
        }),
        },
      );

      setCode("");
      setName("");
      setUnitType("department");
      setParentId("");

      setSuccess(
        "Unidade organizacional cadastrada com sucesso.",
      );

      await loadUnits();
    } catch (cause) {
      if (
        cause instanceof
        ApiError
      ) {
        setError(
          cause.message,
        );
      } else {
        setError(
          "Não foi possível cadastrar o setor.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(
    
    unit: OrganizationUnit,
  ) {
        if (!unit.type) {
      setError(
        "Esta unidade ainda não possui um tipo organizacional definido.",
      );

      return;
    }

    setEditingUnit(
      unit,
    );

    setEditCode(
      unit.code,
    );

    setEditName(
      unit.name,
    );

    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingUnit(
      null,
    );

    setEditCode("");
    setEditName("");

    setError("");
  }

  async function handleUpdate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !editingUnit
    ) {
      return;
    }

    if (
      !editCode.trim() ||
      !editName.trim()
    ) {
      setError(
        "Informe o código e o nome do setor.",
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/api/organization-units/${editingUnit.id}`,
        {
          method: "PATCH",

          body: json({
          code: editCode.trim(),
          name: editName.trim(),
          type: editingUnit.type,
          parentId: editingUnit.parentId,
        }),
        },
      );

      setEditingUnit(
        null,
      );

      setEditCode("");
      setEditName("");

      setSuccess(
        "Setor atualizado com sucesso.",
      );

      await loadUnits();
    } catch (cause) {
      if (
        cause instanceof
        ApiError
      ) {
        setError(
          cause.message,
        );
      } else {
        setError(
          "Não foi possível atualizar o setor.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(
  unit: OrganizationUnit,
) {
  const newActive =
    !unit.active;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api(
      `/api/organization-units/${unit.id}/active`,
      {
        method: "PATCH",

        body: json({
          active:
            newActive,
        }),
      },
    );

    setSuccess(
      newActive
        ? "Setor ativado com sucesso."
        : "Setor inativado com sucesso.",
    );

    await loadUnits();
  } catch (cause) {
    if (
      cause instanceof
      ApiError
    ) {
      setError(
        cause.message,
      );
    } else {
      setError(
        newActive
          ? "Não foi possível ativar o setor."
          : "Não foi possível inativar o setor.",
      );
    }
  } finally {
    setSaving(false);
  }
}

  const departments = units.filter(
    (unit) =>
      unit.type === "department" &&
      unit.active,
  );

  const sectors = units.filter(
    (unit) =>
      unit.type === "sector" &&
      unit.active,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-1 text-2xl font-extrabold md:text-[30px]">
          Setores / Localizações
        </h1>

        <p className="text-sm text-[var(--text-muted)]">
          Cadastre e consulte os
          setores disponíveis para
          localização dos bens
          patrimoniais.
        </p>
      </div>

      {error ? (
        <Alert
          tone="danger"
          title="Não foi possível concluir a operação"
        >
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert
          tone="success"
          title="Operação concluída"
        >
          {success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Novo setor
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Informe o código e
              o nome do setor.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={handleSubmit}
          >

          <FormField
            label="Tipo"
            htmlFor="unit-type"
          >
            <select
              id="unit-type"
              value={unitType}
              onChange={(event) => {
                setUnitType(
                  event.target
                    .value as OrganizationUnitType,
                );

                setParentId("");
              }}
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            >
              <option value="department">
                Departamento
              </option>

              <option value="sector">
                Setor
              </option>

              <option value="subsector">
                Subsetor
              </option>
            </select>
          </FormField>

            <FormField
              label="Código"
              htmlFor="code"
            >
              <Input
                id="code"
                value={code}
                onChange={(
                  event,
                ) =>
                  setCode(
                    event.target
                      .value,
                  )
                }
                placeholder="Ex.: DAF"
              />
            </FormField>

            <FormField
              label="Nome do setor"
              htmlFor="name"
            >
              <Input
                id="name"
                value={name}
                onChange={(
                  event,
                ) =>
                  setName(
                    event.target
                      .value,
                  )
                }
                placeholder="Ex.: Diretoria Administrativa e Financeira"
              />
            </FormField>

            {unitType === "sector" ? (
            <FormField
              label="Departamento"
              htmlFor="parent-department"
            >
              <select
                id="parent-department"
                value={parentId}
                onChange={(event) =>
                  setParentId(event.target.value)
                }
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              >
                <option value="">
                  Selecione...
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.code} -{" "}
                      {department.name}
                    </option>
                  ),
                )}
              </select>
            </FormField>
          ) : null}

          {unitType === "subsector" ? (
            <FormField
              label="Setor"
              htmlFor="parent-sector"
            >
              <select
                id="parent-sector"
                value={parentId}
                onChange={(event) =>
                  setParentId(event.target.value)
                }
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              >
                <option value="">
                  Selecione...
                </option>

                {sectors.map((sector) => (
                  <option
                    key={sector.id}
                    value={sector.id}
                  >
                    {sector.code} -{" "}
                    {sector.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={
                  saving
                }
              >
                <PlusCircle
                  size={18}
                />

                {saving
                  ? "Salvando..."
                  : "Cadastrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editingUnit ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-medium">
                Editar setor
              </h2>

              <p className="text-xs text-[var(--text-muted)]">
                Atualize o código e
                o nome do setor.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-[180px_1fr_auto]"
              onSubmit={
                handleUpdate
              }
            >
              <FormField
                label="Código"
                htmlFor="edit-code"
              >
                <Input
                  id="edit-code"
                  value={
                    editCode
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditCode(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <FormField
                label="Nome do setor"
                htmlFor="edit-name"
              >
                <Input
                  id="edit-name"
                  value={
                    editName
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditName(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <div className="flex items-end gap-2">
                <Button
                  type="submit"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Salvando..."
                    : "Salvar"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    saving
                  }
                  onClick={
                    cancelEdit
                  }
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Setores cadastrados
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Setores disponíveis
              para utilização no
              cadastro dos bens.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">
              Carregando setores...
            </p>
          ) : units.length ===
            0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum setor
              cadastrado.
            </p>
          ) : (
            <Table>
              <thead>
                <TableRow>
                  <TableHead>
                    Código
                  </TableHead>

                  <TableHead>
                    Setor
                  </TableHead>

                  <TableHead>
                    Situação
                  </TableHead>

                  <TableHead>
                    Ações
                  </TableHead>
                </TableRow>
              </thead>

              <tbody>
                {units.map(
                  (unit) => (
                    <TableRow
                      key={
                        unit.id
                      }
                    >
                      <TableCell>
                        <strong>
                          {
                            unit.code
                          }
                        </strong>
                      </TableCell>

                      <TableCell>
                        {
                          unit.name
                        }
                      </TableCell>

                      <TableCell>
                        {unit.active
                          ? "Ativo"
                          : "Inativo"}
                      </TableCell>

                      <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={saving}
                          onClick={() =>
                            startEdit(
                              unit,
                            )
                          }
                        >
                          <PencilSimple
                            size={16}
                          />

                          Editar
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          disabled={saving}
                          onClick={() =>
                            void handleToggleActive(
                              unit,
                            )
                          }
                        >
                          {unit.active ? (
                            <>
                              <Prohibit
                                size={16}
                              />

                              Inativar
                            </>
                          ) : (
                            <>
                              <CheckCircle
                                size={16}
                              />

                              Ativar
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    </TableRow>
                  ),
                )}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}