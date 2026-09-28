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
    selectedDepartmentId,
    setSelectedDepartmentId,
  ] = useState("");

  const [
    selectedSectorId,
    setSelectedSectorId,
  ] = useState("");

  const [
    selectedSubsectorId,
    setSelectedSubsectorId,
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
        unitsResult.units
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

  if (!selectedDepartmentId) {
    setError(
      "Selecione o departamento de destino.",
    );

    return;
  }

  if (!selectedSectorId) {
    setError(
      "Selecione o setor de destino.",
    );

    return;
  }

  if (
    sectorHasSubsectors &&
    !selectedSubsectorId
  ) {
    setError(
      "Selecione o subsetor de destino.",
    );

    return;
  }

  if (
    destinationUnitId ===
    asset.unitId
  ) {
    setError(
      "A nova localização deve ser diferente da localização atual.",
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
            toUnitId:
            destinationUnitId,

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

  const unitsById =
  new Map(
    units.map(
      (unit) => [
        unit.id,
        unit,
      ],
    ),
  );



  const currentDepartment =
    currentUnit?.type === "department"
      ? currentUnit
      : currentUnit?.type === "sector" &&
          currentUnit.parentId
        ? unitsById.get(
            currentUnit.parentId,
          ) ?? null
        : currentUnit?.type === "subsector"
          ? (() => {
              const sector =
                currentUnit.parentId
                  ? unitsById.get(
                      currentUnit.parentId,
                    ) ?? null
                  : null;

              return sector?.parentId
                ? unitsById.get(
                    sector.parentId,
                  ) ?? null
                : null;
            })()
          : null;

  const currentSector =
    currentUnit?.type === "sector"
      ? currentUnit
      : currentUnit?.type === "subsector" &&
          currentUnit.parentId
        ? unitsById.get(
            currentUnit.parentId,
          ) ?? null
        : null;

  const currentSubsector =
    currentUnit?.type === "subsector"
      ? currentUnit
      : null;

  const departments =
    units.filter(
      (unit) =>
        unit.type === "department" &&
        unit.active,
    );

  const sectors =
    units.filter(
      (unit) =>
        unit.type === "sector" &&
        unit.active &&
        unit.parentId ===
          selectedDepartmentId,
    );

  const subsectors =
    units.filter(
      (unit) =>
        unit.type === "subsector" &&
        unit.active &&
        unit.parentId ===
          selectedSectorId,
    );

  const sectorHasSubsectors =
  subsectors.length > 0;

  const destinationUnitId =
  sectorHasSubsectors
    ? selectedSubsectorId
    : selectedSectorId;

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
              Transferência entre unidades organizacionais
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Informe a nova localização do bem.
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
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Departamento atual"
              htmlFor="currentDepartment"
            >
              <div
                id="currentDepartment"
                className="flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm"
              >
                {currentDepartment
                  ? `${currentDepartment.code} - ${currentDepartment.name}`
                  : "Não informado"}
              </div>
            </FormField>

            <FormField
              label="Setor atual"
              htmlFor="currentSector"
            >
              <div
                id="currentSector"
                className="flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm"
              >
                {currentSector
                  ? `${currentSector.code} - ${currentSector.name}`
                  : "Não informado"}
              </div>
            </FormField>

            <FormField
              label="Subsetor atual"
              htmlFor="currentSubsector"
            >
              <div
                id="currentSubsector"
                className="flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm"
              >
                {currentSubsector
                  ? `${currentSubsector.code} - ${currentSubsector.name}`
                  : "Não informado"}
              </div>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
  <FormField
    label="Novo departamento"
    htmlFor="departmentId"
  >
    <select
      id="departmentId"
      value={selectedDepartmentId}
      onChange={(event) => {
        setSelectedDepartmentId(
          event.target.value,
        );

        setSelectedSectorId("");
        setSelectedSubsectorId("");
      }}
      className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      required
    >
      <option value="">
        Selecione um departamento
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

  <FormField
    label="Novo setor"
    htmlFor="sectorId"
  >
    <select
      id="sectorId"
      value={selectedSectorId}
      onChange={(event) => {
        setSelectedSectorId(
          event.target.value,
        );

        setSelectedSubsectorId("");
      }}
      disabled={!selectedDepartmentId}
      className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      required
    >
      <option value="">
        {!selectedDepartmentId
          ? "Selecione primeiro o departamento"
          : "Selecione um setor"}
      </option>

      {sectors.map(
        (sector) => (
          <option
            key={sector.id}
            value={sector.id}
          >
            {sector.code} -{" "}
            {sector.name}
          </option>
        ),
      )}
    </select>
  </FormField>

  <FormField
    label="Novo subsetor"
    htmlFor="toUnitId"
  >
    <select
      id="toUnitId"
      value={selectedSubsectorId}
      onChange={(event) =>
        setSelectedSubsectorId(
          event.target.value,
        )
      }
      disabled={
        !selectedSectorId ||
        !sectorHasSubsectors
      }
      className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      required={
        sectorHasSubsectors
      }
    >
      <option value="">
        {!selectedSectorId
          ? "Selecione primeiro o setor"
          : sectorHasSubsectors
            ? "Selecione um subsetor"
            : "Este setor não possui subsetores"}
      </option>

      {subsectors.map(
        (subsector) => (
          <option
            key={subsector.id}
            value={subsector.id}
          >
            {subsector.code} -{" "}
            {subsector.name}
          </option>
        ),
      )}
    </select>
  </FormField>

</div>

<div className="grid gap-4 sm:grid-cols-2">
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
        value={notes}
        onChange={(event) =>
          setNotes(
            event.target.value,
          )
        }
        placeholder="Ex.: Transferência do bem para nova unidade organizacional..."
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