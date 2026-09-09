import type {
  Asset,
} from "@cge/contracts";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  DatePicker,
  FormField,
  Textarea,
} from "@cge/ui";

import {
  ArrowLeft,
  ArrowsLeftRight,
} from "@phosphor-icons/react";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

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

export function AssetMovementPage() {
  const {
    id,
  } = useParams();

  const navigate =
    useNavigate();

  const [
    asset,
    setAsset,
  ] = useState<Asset | null>(
    null,
  );

  const [
    units,
    setUnits,
  ] = useState<
    OrganizationUnit[]
  >([]);

  const [
    toUnitId,
    setToUnitId,
  ] = useState("");

  const [
    notes,
    setNotes,
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
  currentUnit,
  setCurrentUnit,
  ] =
  useState<OrganizationUnit | null>(
    null,
  );

  useEffect(() => {
    if (!id) {
      setError(
        "Identificador do bem não informado.",
      );

      setLoading(false);

      return;
    }

    void loadData(id);
  }, [id]);

  async function loadData(
    assetId: string,
  ) {
    try {
      setLoading(true);
      setError("");

      const [
        assetResult,
        unitsResult,
      ] = await Promise.all([
        api<Asset>(
          `/api/assets/${assetId}`,
        ),

        api<OrganizationUnitsResponse>(
          "/api/organization-units",
        ),
      ]);

      setAsset(
        assetResult,
      );

        setCurrentUnit(
        assetResult.unitId
            ? unitsResult.units.find(
                (unit) =>
                unit.id ===
                assetResult.unitId,
            ) ?? null
            : null,
        );

        setUnits(
        unitsResult.units.filter(
          (unit) =>
            unit.active &&
            unit.id !==
              assetResult.unitId,
        ),
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
          "Não foi possível carregar os dados para movimentação.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !id ||
      !asset
    ) {
      return;
    }

    if (!toUnitId) {
      setError(
        "Selecione o setor de destino.",
      );

      return;
    }

    const formData =
      new FormData(
        event.currentTarget,
      );

    const movementDate =
      String(
        formData.get(
          "movementDate",
        ) ?? "",
      );

    if (!movementDate) {
      setError(
        "Informe a data da movimentação.",
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      await api(
        `/api/assets/${id}/movements`,
        {
          method: "POST",

          body: json({
            toUnitId,

            movementDate,

            notes:
              optionalString(
                notes,
              ),
          }),
        },
      );

      navigate(
        `/patrimonio/bens/${id}`,
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
          "Não foi possível realizar a movimentação do bem.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-[var(--text-muted)]">
        Carregando dados...
      </div>
    );
  }

  if (
    error &&
    !asset
  ) {
    return (
      <div className="space-y-6">
        <Button
          asChild
          variant="secondary"
        >
          <Link
            to="/patrimonio/bens"
          >
            <ArrowLeft
              size={18}
            />

            Voltar
          </Link>
        </Button>

        <Alert
          tone="danger"
          title="Não foi possível carregar o bem"
        >
          {error}
        </Alert>
      </div>
    );
  }

  if (!asset) {
    return null;
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Movimentar Bem Patrimonial
          </h1>

          <p className="text-sm text-[var(--text-muted)]">
            Tombo{" "}
            {asset.patrimonyNumber}
          </p>
        </div>

        <Button
          asChild
          variant="secondary"
        >
          <Link
            to={`/patrimonio/bens/${asset.id}`}
          >
            <ArrowLeft
              size={18}
            />

            Voltar
          </Link>
        </Button>
      </div>

      {error ? (
        <Alert
          tone="danger"
          title="Não foi possível concluir a movimentação"
        >
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Transferência entre setores
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Informe o novo setor
              onde o bem ficará
              localizado.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-6"
            onSubmit={
              handleSubmit
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Setor atual"
                htmlFor="currentUnit"
              >
                <div
                  id="currentUnit"
                  className="flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm"
                >
                  {currentUnit
                    ? `${currentUnit.code} - ${currentUnit.name}`
                    : "Não informado"}
                </div>
              </FormField>

              <FormField
                label="Novo setor"
                htmlFor="toUnitId"
              >
                <select
                  id="toUnitId"
                  className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  value={
                    toUnitId
                  }
                  onChange={(
                    event,
                  ) =>
                    setToUnitId(
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Selecione...
                  </option>

                  {units.map(
                    (unit) => (
                      <option
                        key={
                          unit.id
                        }
                        value={
                          unit.id
                        }
                      >
                        {
                          unit.code
                        }{" "}
                        -{" "}
                        {
                          unit.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField
                label="Data da movimentação"
                htmlFor="movementDate"
              >
                <DatePicker
                  id="movementDate"
                  name="movementDate"
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField
                  label="Observação"
                  htmlFor="notes"
                >
                  <Textarea
                    id="notes"
                    value={
                      notes
                    }
                    onChange={(
                      event,
                    ) =>
                      setNotes(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ex.: Transferência para utilização pelo setor..."
                  />
                </FormField>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                asChild
                variant="secondary"
              >
                <Link
                  to={`/patrimonio/bens/${asset.id}`}
                >
                  Cancelar
                </Link>
              </Button>

              <Button
                type="submit"
                disabled={
                  saving
                }
              >
                <ArrowsLeftRight
                  size={18}
                />

                {saving
                  ? "Movimentando..."
                  : "Confirmar movimentação"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function optionalString(
  value: string,
) {
  const normalized =
    value.trim();

  return normalized
    ? normalized
    : null;
}