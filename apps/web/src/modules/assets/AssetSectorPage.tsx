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
  PencilSimple,
  PlusCircle,
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

type OrganizationUnit = {
  id: string;
  code: string;
  name: string;
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

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        "/api/organization-units",
        {
          method: "POST",

          body: json({
            code:
              code.trim(),

            name:
              name.trim(),

            parentId:
              null,
          }),
        },
      );

      setCode("");
      setName("");

      setSuccess(
        "Setor cadastrado com sucesso.",
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
            code:
              editCode.trim(),

            name:
              editName.trim(),

            parentId:
              editingUnit.parentId,
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
            className="grid gap-4 sm:grid-cols-[180px_1fr_auto]"
            onSubmit={
              handleSubmit
            }
          >
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
                        <Button
                          type="button"
                          variant="secondary"
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