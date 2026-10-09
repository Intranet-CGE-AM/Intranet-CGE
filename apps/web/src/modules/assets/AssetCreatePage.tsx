import type { Asset, AssetCreate } from "@cge/contracts";

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
  Select,
  Textarea,
} from "@cge/ui";

import { useEffect, useState, type FormEvent } from "react";

import { Link, useNavigate } from "react-router";

import { api, ApiError, json } from "../../lib/api";

import {
  conservationOptions,
  optionalString,
  PageHeader,
  unitOptions,
  type OrganizationUnit,
  type OrganizationUnitsResponse,
} from "./shared";

// Radix Select rejects "" as an item value, so "Não informado" uses a sentinel.
const NONE = "__none__";

const conservationSelectOptions = [
  { label: "Não informado", value: NONE },
  ...conservationOptions,
];

type FieldErrors = Partial<
  Record<
    | "patrimonyNumber"
    | "description"
    | "departmentId"
    | "sectorId"
    | "acquisitionValue",
    string
  >
>;

export function AssetCreatePage() {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);

  const [loadingUnits, setLoadingUnits] = useState(true);

  const [units, setUnits] = useState<OrganizationUnit[]>([]);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const [selectedSectorId, setSelectedSectorId] = useState("");

  const [selectedSubsectorId, setSelectedSubsectorId] = useState("");

  const [conservationStatus, setConservationStatus] = useState("");

  const [error, setError] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    void loadUnits();
  }, []);

  async function loadUnits() {
    try {
      setLoadingUnits(true);

      const result = await api<OrganizationUnitsResponse>(
        "/api/organization-units",
      );

      setUnits(result.units.filter((unit) => unit.active));
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível carregar a estrutura organizacional.");
      }
    } finally {
      setLoadingUnits(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    const patrimonyNumber = String(data.get("patrimonyNumber") ?? "").trim();

    const description = String(data.get("description") ?? "").trim();

    const unitId = selectedSubsectorId || selectedSectorId;

    const acquisitionValueText = String(
      data.get("acquisitionValue") ?? "",
    ).trim();

    const nextErrors: FieldErrors = {};

    if (!patrimonyNumber) {
      nextErrors.patrimonyNumber = "Informe o número do tombo.";
    }

    if (!description || description.length < 2) {
      nextErrors.description = "Informe o material ou descrição do bem.";
    }

    if (!selectedDepartmentId) {
      nextErrors.departmentId =
        "Selecione o departamento onde o bem está localizado.";
    }

    if (!selectedSectorId) {
      nextErrors.sectorId = "Selecione o setor onde o bem está localizado.";
    }

    let acquisitionValue: number | null = null;

    if (acquisitionValueText) {
      const normalizedValue =
        acquisitionValueText
          .replace(/\./g, "")
          .replace(",", ".");

      const parsed =
        Number(normalizedValue);

      if (Number.isNaN(parsed) || parsed < 0) {
        nextErrors.acquisitionValue = "Informe um valor de aquisição válido.";
      } else {
        acquisitionValue = parsed;
      }
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 ) { return;}

    const input: AssetCreate = {
      patrimonyNumber,
      description,

      unitId,

      brand: optionalString(data.get("brand")),
      model: optionalString(data.get("model")),
      serialNumber: optionalString(data.get("serialNumber")),

      usageDate: optionalString(data.get("usageDate")),

      documentNumber: optionalString(data.get("documentNumber")),
      documentDate: optionalString(data.get("documentDate")),

      acquisitionDate: optionalString(data.get("acquisitionDate")),
      acquisitionValue,

      commitmentNumber: optionalString(data.get("commitmentNumber")),

      conservationStatus: optionalString(conservationStatus),

      renavam: optionalString(data.get("renavam")),
      chassis: optionalString(data.get("chassis")),

      notes: optionalString(data.get("notes")),
    };

    try {
      setSaving(true);
      setError("");

      await api<Asset>("/api/assets", {
        method: "POST",

        body: json(input),
      });

      navigate("/patrimonio/bens");
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível cadastrar o bem patrimonial.");
      }
    } finally {
      setSaving(false);
    }
  }

  const departments = units.filter((unit) => unit.type === "department");

  const sectors = units.filter(
    (unit) => unit.type === "sector" && unit.parentId === selectedDepartmentId,
  );

  const subsectors = units.filter(
    (unit) => unit.type === "subsector" && unit.parentId === selectedSectorId,
  );

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        backTo="/patrimonio/bens"
        description="Cadastre um novo bem patrimonial."
        title="Novo bem patrimonial"
      />

      {error ? (
        <Alert tone="danger" title="Não foi possível cadastrar o bem">
          {error}
        </Alert>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Identificação</h2>

              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Dados principais de identificação do bem.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                error={errors.patrimonyNumber}
                htmlFor="patrimonyNumber"
                label="Número do tombo"
              >
                <Input
                  aria-invalid={Boolean(errors.patrimonyNumber)}
                  autoComplete="off"
                  id="patrimonyNumber"
                  name="patrimonyNumber"
                  placeholder="Ex.: 335"
                  required
                />
              </FormField>

              <FormField
                htmlFor="serialNumber"
                label="Número de série (opcional)"
              >
                <Input
                  autoComplete="off"
                  id="serialNumber"
                  name="serialNumber"
                  placeholder="Número de série"
                />
              </FormField>

              <FormField
                className="sm:col-span-2"
                error={errors.description}
                htmlFor="description"
                label="Material / descrição"
              >
                <Textarea
                  aria-invalid={Boolean(errors.description)}
                  id="description"
                  name="description"
                  placeholder="Ex.: NOBREAK, potência 3000VA..."
                  required
                  rows={4}
                />
              </FormField>

              <FormField htmlFor="brand" label="Marca (opcional)">
                <Input id="brand" name="brand" placeholder="Ex.: APC" />
              </FormField>

              <FormField htmlFor="model" label="Modelo (opcional)">
                <Input id="model" name="model" placeholder="Modelo do bem" />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Localização</h2>

              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Informe onde o bem está localizado.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                error={errors.departmentId}
                htmlFor="departmentId"
                label="Departamento"
              >
                <SearchableSelect
                  aria-invalid={Boolean(errors.departmentId)}
                  disabled={loadingUnits}
                  id="departmentId"
                  name="departmentId"
                  options={unitOptions(departments)}
                  placeholder={
                    loadingUnits
                      ? "Carregando departamentos..."
                      : "Selecione um departamento"
                  }
                  required
                  value={selectedDepartmentId}
                  onValueChange={(value) => {
                    setSelectedDepartmentId(value);

                    setSelectedSectorId("");
                    setSelectedSubsectorId("");
                  }}
                />
              </FormField>

              <FormField
                error={errors.sectorId}
                htmlFor="sectorId"
                label="Setor"
              >
                <SearchableSelect
                  aria-invalid={Boolean(errors.sectorId)}
                  disabled={loadingUnits || !selectedDepartmentId}
                  id="sectorId"
                  name="sectorId"
                  options={unitOptions(sectors)}
                  placeholder={
                    !selectedDepartmentId
                      ? "Selecione primeiro o departamento"
                      : "Selecione um setor"
                  }
                  required
                  value={selectedSectorId}
                  onValueChange={(value) => {
                    setSelectedSectorId(value);

                    setSelectedSubsectorId("");
                  }}
                />
              </FormField>

              <FormField
                htmlFor="unitId"
                label="Subsetor (opcional)"
              >
                <SearchableSelect
                  disabled={
                    loadingUnits ||
                    !selectedSectorId
                  }
                  id="unitId"
                  name="unitId"
                  options={[
                    {
                      label:
                        "Nenhum subsetor",
                      value:
                        NONE,
                    },

                    ...unitOptions(
                      subsectors,
                    ),
                  ]}
                  placeholder={
                    !selectedSectorId
                      ? "Selecione primeiro o setor"
                      : "Subsetor opcional"
                  }
                  value={
                    selectedSubsectorId ||
                    NONE
                  }
                  onValueChange={(
                    value,
                  ) => {
                    setSelectedSubsectorId(
                      value === NONE
                        ? ""
                        : value,
                    );
                  }}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">
                Nota fiscal, documentação e aquisição
              </h2>

              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Informações do documento de aquisição do bem.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                htmlFor="usageDate"
                label="Data de utilização (opcional)"
              >
                <DatePicker
                  id="usageDate"
                  name="usageDate"
                  placeholder="Selecione a data"
                />
              </FormField>

              <FormField
                htmlFor="acquisitionDate"
                label="Data de aquisição (opcional)"
              >
                <DatePicker
                  id="acquisitionDate"
                  name="acquisitionDate"
                  placeholder="Selecione a data"
                />
              </FormField>

              <FormField htmlFor="documentNumber" label="Documento (opcional)">
                <Input
                  id="documentNumber"
                  name="documentNumber"
                  placeholder="Ex.: NF551"
                />
              </FormField>

              <FormField
                htmlFor="documentDate"
                label="Data do documento (opcional)"
              >
                <DatePicker
                  id="documentDate"
                  name="documentDate"
                  placeholder="Selecione a data"
                />
              </FormField>

              <FormField
                error={errors.acquisitionValue}
                htmlFor="acquisitionValue"
                label="Valor de aquisição (opcional)"
              >
                <Input
                  aria-invalid={Boolean(errors.acquisitionValue)}
                  id="acquisitionValue"
                  inputMode="decimal"
                  name="acquisitionValue"
                  placeholder="0,00"
                />
              </FormField>

              <FormField htmlFor="commitmentNumber" label="Empenho (opcional)">
                <Input
                  id="commitmentNumber"
                  name="commitmentNumber"
                  placeholder="Ex.: 2021NE00045"
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Estado e informações complementares</h2>

              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Condição física e informações adicionais do patrimônio.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                className="sm:col-span-2"
                htmlFor="conservationStatus"
                label="Conservação (opcional)"
              >
                <Select
                  id="conservationStatus"
                  name="conservationStatus"
                  options={conservationSelectOptions}
                  placeholder="Selecione"
                  value={conservationStatus}
                  onValueChange={(value) =>
                    setConservationStatus(value === NONE ? "" : value)
                  }
                />
              </FormField>

              <FormField htmlFor="renavam" label="RENAVAM (opcional)">
                <Input
                  id="renavam"
                  name="renavam"
                  placeholder="Aplicável a veículos"
                />
              </FormField>

              <FormField htmlFor="chassis" label="Chassi (opcional)">
                <Input
                  id="chassis"
                  name="chassis"
                  placeholder="Aplicável a veículos"
                />
              </FormField>

              <FormField
                className="sm:col-span-2"
                htmlFor="notes"
                label="Observações (opcional)"
              >
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Informações adicionais sobre o bem..."
                  rows={4}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="secondary">
            <Link to="/patrimonio/bens">Cancelar</Link>
          </Button>

          <Button disabled={saving || loadingUnits} type="submit">
            {saving ? "Salvando..." : "Cadastrar bem"}
          </Button>
        </div>
      </form>
    </div>
  );
}
