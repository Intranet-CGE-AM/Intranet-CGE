import type {
  Asset,
  AssetCreate,
} from "@cge/contracts";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  DatePicker,
  FormField,
  Input,
  Textarea,
} from "@cge/ui";

import {
  ArrowLeft,
  FloppyDisk,
} from "@phosphor-icons/react";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Link,
  useNavigate,
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

export function AssetCreatePage() {
  const navigate =
    useNavigate();

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loadingUnits,
    setLoadingUnits,
  ] = useState(true);

  const [
    units,
    setUnits,
  ] = useState<OrganizationUnit[]>([]);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    void loadUnits();
  }, []);

  async function loadUnits() {
    try {
      setLoadingUnits(true);

      const result =
        await api<OrganizationUnitsResponse>(
          "/api/organization-units",
        );

      setUnits(
        result.units.filter(
          (unit) =>
            unit.active,
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
          "Não foi possível carregar os setores.",
        );
      }
    } finally {
      setLoadingUnits(false);
    }
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    const patrimonyNumber =
      requiredString(
        data.get(
          "patrimonyNumber",
        ),
      );

    const description =
      requiredString(
        data.get(
          "description",
        ),
      );

    const unitId =
      optionalString(
        data.get(
          "unitId",
        ),
      );

    const room =
      optionalString(
        data.get(
          "room",
        ),
      );

    const brand =
      optionalString(
        data.get(
          "brand",
        ),
      );

    const model =
      optionalString(
        data.get(
          "model",
        ),
      );

    const serialNumber =
      optionalString(
        data.get(
          "serialNumber",
        ),
      );

    const usageDate =
      optionalString(
        data.get(
          "usageDate",
        ),
      );

    const documentNumber =
      optionalString(
        data.get(
          "documentNumber",
        ),
      );

    const documentDate =
      optionalString(
        data.get(
          "documentDate",
        ),
      );

    const acquisitionDate =
      optionalString(
        data.get(
          "acquisitionDate",
        ),
      );

    const commitmentNumber =
      optionalString(
        data.get(
          "commitmentNumber",
        ),
      );

    const conservationStatus =
      optionalString(
        data.get(
          "conservationStatus",
        ),
      );

    const renavam =
      optionalString(
        data.get(
          "renavam",
        ),
      );

    const chassis =
      optionalString(
        data.get(
          "chassis",
        ),
      );

    const notes =
      optionalString(
        data.get(
          "notes",
        ),
      );

    const acquisitionValueText =
      String(
        data.get(
          "acquisitionValue",
        ) ?? "",
      ).trim();

    if (!patrimonyNumber) {
      setError(
        "Informe o número do tombo.",
      );

      return;
    }

    if (
      !description ||
      description.length < 2
    ) {
      setError(
        "Informe o material ou descrição do bem.",
      );

      return;
    }

    if (!unitId) {
      setError(
        "Selecione o setor / localização do bem.",
      );

      return;
    }

    let acquisitionValue:
      number | null = null;

    if (
      acquisitionValueText
    ) {
      const parsed =
        Number(
          acquisitionValueText,
        );

      if (
        Number.isNaN(parsed) ||
        parsed < 0
      ) {
        setError(
          "Informe um valor de aquisição válido.",
        );

        return;
      }

      acquisitionValue =
        parsed;
    }

    const input:
      AssetCreate = {
        patrimonyNumber,
        description,

        unitId,

        room,

        brand,
        model,
        serialNumber,

        usageDate,

        documentNumber,
        documentDate,

        acquisitionDate,
        acquisitionValue,

        commitmentNumber,

        conservationStatus,

        renavam,
        chassis,

        notes,
      };

    try {
      setSaving(true);
      setError("");

      await api<Asset>(
        "/api/assets",
        {
          method: "POST",

          body:
            json(input),
        },
      );

      navigate(
        "/patrimonio/bens",
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
          "Não foi possível cadastrar o bem patrimonial.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-extrabold md:text-[20px]">
            Novo Bem Patrimonial
          </h1>

          <p className="text-sm text-[var(--text-muted)]">
            Cadastre um novo bem
            patrimonial.
          </p>
        </div>

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
      </div>

      {error ? (
        <Alert
          tone="danger"
          title="Não foi possível cadastrar o bem"
        >
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={
          handleSubmit
        }
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-medium">
                  Identificação
                </h2>

                <p className="text-xs text-[var(--text-muted)]">
                  Dados principais
                  de identificação
                  do bem.
                </p>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  htmlFor="patrimonyNumber"
                  label="Tombo"
                >
                  <Input
                    autoComplete="off"
                    id="patrimonyNumber"
                    name="patrimonyNumber"
                    placeholder="Ex.: 335"
                    required
                  />
                </FormField>

                <FormField
                  htmlFor="serialNumber"
                  label="Número de série"
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
                  htmlFor="description"
                  label="Material / Descrição"
                >
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Ex.: NOBREAK, potência 3000VA..."
                    required
                    rows={4}
                  />
                </FormField>

                <FormField
                  htmlFor="brand"
                  label="Marca"
                >
                  <Input
                    id="brand"
                    name="brand"
                    placeholder="Ex.: APC"
                  />
                </FormField>

                <FormField
                  htmlFor="model"
                  label="Modelo"
                >
                  <Input
                    id="model"
                    name="model"
                    placeholder="Modelo do bem"
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-medium">
                  Localização
                </h2>

                <p className="text-xs text-[var(--text-muted)]">
                  Informe onde o
                  bem está localizado.
                </p>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  htmlFor="unitId"
                  label="Setor / Localização"
                >
                  <select
                    className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    disabled={
                      loadingUnits
                    }
                    id="unitId"
                    name="unitId"
                    required
                  >
                    <option value="">
                      {loadingUnits
                        ? "Carregando setores..."
                        : "Selecione um setor"}
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
                  htmlFor="room"
                  label="Sala"
                >
                  <Input
                    id="room"
                    name="room"
                    placeholder="Ex.: Sala do DETINDE"
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-medium">
                  Documentação e aquisição
                </h2>

                <p className="text-xs text-[var(--text-muted)]">
                  Informações do
                  documento de aquisição
                  do bem.
                </p>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  htmlFor="usageDate"
                  label="Data de utilização"
                >
                  <DatePicker
                    id="usageDate"
                    name="usageDate"
                    placeholder="Selecione a data"
                  />
                </FormField>

                <FormField
                  htmlFor="acquisitionDate"
                  label="Data de aquisição"
                >
                  <DatePicker
                    id="acquisitionDate"
                    name="acquisitionDate"
                    placeholder="Selecione a data"
                  />
                </FormField>

                <FormField
                  htmlFor="documentNumber"
                  label="Documento"
                >
                  <Input
                    id="documentNumber"
                    name="documentNumber"
                    placeholder="Ex.: NF551"
                  />
                </FormField>

                <FormField
                  htmlFor="documentDate"
                  label="Data do documento"
                >
                  <DatePicker
                    id="documentDate"
                    name="documentDate"
                    placeholder="Selecione a data"
                  />
                </FormField>

                <FormField
                  htmlFor="acquisitionValue"
                  label="Valor de aquisição"
                >
                  <Input
                    id="acquisitionValue"
                    min="0"
                    name="acquisitionValue"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                  />
                </FormField>

                <FormField
                  htmlFor="commitmentNumber"
                  label="Empenho"
                >
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
                <h2 className="font-medium">
                  Estado e informações complementares
                </h2>

                <p className="text-xs text-[var(--text-muted)]">
                  Condição física e
                  informações adicionais
                  do patrimônio.
                </p>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  htmlFor="conservationStatus"
                  label="Conservação"
                >
                  <select
                    className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    id="conservationStatus"
                    name="conservationStatus"
                  >
                    <option value="">
                      Selecione
                    </option>

                    <option value="Ótimo">
                      Ótimo
                    </option>

                    <option value="Bom">
                      Bom
                    </option>

                    <option value="Regular">
                      Regular
                    </option>

                    <option value="Ruim">
                      Ruim
                    </option>

                    <option value="Inservível">
                      Inservível
                    </option>
                  </select>
                </FormField>

                <div />

                <FormField
                  htmlFor="renavam"
                  label="RENAVAM"
                >
                  <Input
                    id="renavam"
                    name="renavam"
                    placeholder="Aplicável a veículos"
                  />
                </FormField>

                <FormField
                  htmlFor="chassis"
                  label="Chassi"
                >
                  <Input
                    id="chassis"
                    name="chassis"
                    placeholder="Aplicável a veículos"
                  />
                </FormField>

                <FormField
                  className="sm:col-span-2"
                  htmlFor="notes"
                  label="Observações"
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

          <div className="flex justify-end gap-3">
            <Button
              asChild
              variant="secondary"
            >
              <Link
                to="/patrimonio/bens"
              >
                Cancelar
              </Link>
            </Button>

            <Button
              disabled={
                saving ||
                loadingUnits
              }
              type="submit"
            >
              <FloppyDisk
                size={18}
              />

              {saving
                ? "Salvando..."
                : "Cadastrar bem"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function optionalString(
  value:
    FormDataEntryValue | null,
) {
  const text =
    String(
      value ?? "",
    ).trim();

  return text || null;
}

function requiredString(
  value:
    FormDataEntryValue | null,
) {
  return String(
    value ?? "",
  ).trim();
}