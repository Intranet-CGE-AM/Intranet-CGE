import type { Asset } from "@cge/contracts";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  DatePicker,
  FormField,
  Input,
  SearchableSelect,
  Textarea,
} from "@cge/ui";

import { type FormEvent, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { api, ApiError, json } from "../../lib/api";

import {
  optionalString,
  PageHeader,
  PageSkeleton,
  unitOptions,
  type OrganizationUnit,
  type OrganizationUnitsResponse,
} from "./shared";

export function AssetMovementPage() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [asset, setAsset] = useState<Asset | null>(null);

  const [units, setUnits] = useState<OrganizationUnit[]>([]);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const [selectedSectorId, setSelectedSectorId] = useState("");

  const [selectedSubsectorId, setSelectedSubsectorId] = useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [currentUnit, setCurrentUnit] = useState<OrganizationUnit | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Identificador do bem não informado.");

      setLoading(false);

      return;
    }

    void loadData(id);
  }, [id]);

  async function loadData(assetId: string) {
    try {
      setLoading(true);
      setError("");

      const [assetResult, unitsResult] = await Promise.all([
        api<Asset>(`/api/assets/${assetId}`),

        api<OrganizationUnitsResponse>("/api/organization-units"),
      ]);

      setAsset(assetResult);

      setCurrentUnit(
        assetResult.unitId
          ? (unitsResult.units.find((unit) => unit.id === assetResult.unitId) ??
              null)
          : null,
      );

      setUnits(unitsResult.units);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível carregar os dados para movimentação.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id || !asset) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const movementDate = String(formData.get("movementDate") ?? "");

    const errors: Record<string, string> = {};

    if (!selectedDepartmentId) {
      errors.departmentId = "Selecione o departamento de destino.";
    }

    if (selectedDepartmentId && !selectedSectorId) {
      errors.sectorId = "Selecione o setor de destino.";
    }

    if (selectedSectorId && sectorHasSubsectors && !selectedSubsectorId) {
      errors.toUnitId = "Selecione o subsetor de destino.";
    }

    if (!movementDate) {
      errors.movementDate = "Informe a data da movimentação.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("");

      return;
    }

    if (destinationUnitId === asset.unitId) {
      setError("A nova localização deve ser diferente da localização atual.");

      return;
    }

    try {
      setSaving(true);
      setError("");
      setFieldErrors({});

      await api(`/api/assets/${id}/movements`, {
        method: "POST",

        body: json({
          toUnitId: destinationUnitId,

          movementDate,

          notes: optionalString(notes),
        }),
      });

      navigate(`/patrimonio/bens/${id}`);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível realizar a movimentação do bem.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageSkeleton label="Carregando dados para movimentação" />;
  }

  if (error && !asset) {
    return (
      <div className="page-enter space-y-5">
        <PageHeader
          title="Movimentar bem patrimonial"
          backTo="/patrimonio/bens"
        />

        <Alert tone="danger" title="Não foi possível carregar o bem">
          {error}
        </Alert>
      </div>
    );
  }

  if (!asset) {
    return null;
  }

  const unitsById = new Map(units.map((unit) => [unit.id, unit]));

  const currentDepartment =
    currentUnit?.type === "department"
      ? currentUnit
      : currentUnit?.type === "sector" && currentUnit.parentId
        ? (unitsById.get(currentUnit.parentId) ?? null)
        : currentUnit?.type === "subsector"
          ? (() => {
              const sector = currentUnit.parentId
                ? (unitsById.get(currentUnit.parentId) ?? null)
                : null;

              return sector?.parentId
                ? (unitsById.get(sector.parentId) ?? null)
                : null;
            })()
          : null;

  const currentSector =
    currentUnit?.type === "sector"
      ? currentUnit
      : currentUnit?.type === "subsector" && currentUnit.parentId
        ? (unitsById.get(currentUnit.parentId) ?? null)
        : null;

  const currentSubsector =
    currentUnit?.type === "subsector" ? currentUnit : null;

  const departments = units.filter(
    (unit) => unit.type === "department" && unit.active,
  );

  const sectors = units.filter(
    (unit) =>
      unit.type === "sector" &&
      unit.active &&
      unit.parentId === selectedDepartmentId,
  );

  const subsectors = units.filter(
    (unit) =>
      unit.type === "subsector" &&
      unit.active &&
      unit.parentId === selectedSectorId,
  );

  const sectorHasSubsectors = subsectors.length > 0;

  const destinationUnitId = sectorHasSubsectors
    ? selectedSubsectorId
    : selectedSectorId;

  const currentValue = (unit: OrganizationUnit | null) =>
    unit ? `${unit.code} - ${unit.name}` : "Não informado";

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        backTo={`/patrimonio/bens/${asset.id}`}
        title="Movimentar bem patrimonial"
        description={`Tombo ${asset.patrimonyNumber}`}
      />

      {error ? (
        <Alert tone="danger" title="Não foi possível concluir a movimentação">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">
              Transferência entre unidades organizacionais
            </h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Informe a nova localização do bem.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Departamento atual" htmlFor="currentDepartment">
                <Input
                  id="currentDepartment"
                  readOnly
                  className="bg-[var(--surface-subtle)]"
                  value={currentValue(currentDepartment)}
                />
              </FormField>

              <FormField label="Setor atual" htmlFor="currentSector">
                <Input
                  id="currentSector"
                  readOnly
                  className="bg-[var(--surface-subtle)]"
                  value={currentValue(currentSector)}
                />
              </FormField>

              <FormField label="Subsetor atual" htmlFor="currentSubsector">
                <Input
                  id="currentSubsector"
                  readOnly
                  className="bg-[var(--surface-subtle)]"
                  value={currentValue(currentSubsector)}
                />
              </FormField>

              <FormField
                label="Novo departamento"
                htmlFor="departmentId"
                error={fieldErrors.departmentId}
              >
                <SearchableSelect
                  id="departmentId"
                  name="departmentId"
                  aria-invalid={Boolean(fieldErrors.departmentId)}
                  options={unitOptions(departments)}
                  placeholder="Selecione um departamento"
                  value={selectedDepartmentId}
                  onValueChange={(value) => {
                    setSelectedDepartmentId(value);

                    setSelectedSectorId("");
                    setSelectedSubsectorId("");
                  }}
                  required
                />
              </FormField>

              <FormField
                label="Novo setor"
                htmlFor="sectorId"
                error={fieldErrors.sectorId}
              >
                <SearchableSelect
                  id="sectorId"
                  name="sectorId"
                  aria-invalid={Boolean(fieldErrors.sectorId)}
                  options={unitOptions(sectors)}
                  placeholder={
                    !selectedDepartmentId
                      ? "Selecione primeiro o departamento"
                      : "Selecione um setor"
                  }
                  value={selectedSectorId}
                  onValueChange={(value) => {
                    setSelectedSectorId(value);

                    setSelectedSubsectorId("");
                  }}
                  disabled={!selectedDepartmentId}
                  required
                />
              </FormField>

              <FormField
                label="Novo subsetor"
                htmlFor="toUnitId"
                error={fieldErrors.toUnitId}
              >
                <SearchableSelect
                  id="toUnitId"
                  name="toUnitId"
                  aria-invalid={Boolean(fieldErrors.toUnitId)}
                  options={unitOptions(subsectors)}
                  placeholder={
                    !selectedSectorId
                      ? "Selecione primeiro o setor"
                      : sectorHasSubsectors
                        ? "Selecione um subsetor"
                        : "Este setor não possui subsetores"
                  }
                  value={selectedSubsectorId}
                  onValueChange={setSelectedSubsectorId}
                  disabled={!selectedSectorId || !sectorHasSubsectors}
                  required={sectorHasSubsectors}
                />
              </FormField>

              <FormField
                label="Data da movimentação"
                htmlFor="movementDate"
                error={fieldErrors.movementDate}
              >
                <DatePicker id="movementDate" name="movementDate" required />
              </FormField>

              <FormField
                className="sm:col-span-3"
                label="Observação (opcional)"
                htmlFor="notes"
              >
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: Transferência do bem para nova unidade organizacional..."
                />
              </FormField>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="secondary">
                <Link to={`/patrimonio/bens/${asset.id}`}>Cancelar</Link>
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Registrar movimentação"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
