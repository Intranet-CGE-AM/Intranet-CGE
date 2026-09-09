import type {
  Asset,
  AssetUpdate,
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

export function AssetEditPage() {
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
    patrimonyNumber,
    setPatrimonyNumber,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    brand,
    setBrand,
  ] = useState("");

  const [
    model,
    setModel,
  ] = useState("");

  const [
    serialNumber,
    setSerialNumber,
  ] = useState("");

  const [
    room,
    setRoom,
  ] = useState("");

  const [
    usageDate,
    setUsageDate,
  ] = useState("");

  const [
    acquisitionDate,
    setAcquisitionDate,
  ] = useState("");

  const [
    documentNumber,
    setDocumentNumber,
  ] = useState("");

  const [
    documentDate,
    setDocumentDate,
  ] = useState("");

  const [
    acquisitionValue,
    setAcquisitionValue,
  ] = useState("");

  const [
    commitmentNumber,
    setCommitmentNumber,
  ] = useState("");

  const [
    conservationStatus,
    setConservationStatus,
  ] = useState("");

  const [
    renavam,
    setRenavam,
  ] = useState("");

  const [
    chassis,
    setChassis,
  ] = useState("");

  const [
    notes,
    setNotes,
  ] = useState("");

  useEffect(() => {
    if (!id) {
      setError(
        "Identificador do bem não informado.",
      );

      setLoading(false);

      return;
    }

    void loadAsset(id);
  }, [id]);

  async function loadAsset(
    assetId: string,
  ) {
    try {
      setLoading(true);
      setError("");

      const result =
        await api<Asset>(
          `/api/assets/${assetId}`,
        );

      setAsset(
        result,
      );

      setPatrimonyNumber(
        result.patrimonyNumber,
      );

      setDescription(
        result.description,
      );

      setBrand(
        result.brand ?? "",
      );

      setModel(
        result.model ?? "",
      );

      setSerialNumber(
        result.serialNumber ?? "",
      );

      setRoom(
        result.room ?? "",
      );

      setUsageDate(
        result.usageDate ?? "",
      );

      setAcquisitionDate(
        result.acquisitionDate ?? "",
      );

      setDocumentNumber(
        result.documentNumber ?? "",
      );

      setDocumentDate(
        result.documentDate ?? "",
      );

      setAcquisitionValue(
        result.acquisitionValue !== null
          ? String(
              result.acquisitionValue,
            )
          : "",
      );

      setCommitmentNumber(
        result.commitmentNumber ?? "",
      );

      setConservationStatus(
        result.conservationStatus ?? "",
      );

      setRenavam(
        result.renavam ?? "",
      );

      setChassis(
        result.chassis ?? "",
      );

      setNotes(
        result.notes ?? "",
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
          "Não foi possível carregar os dados do bem.",
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

    const formData =
  new FormData(
    event.currentTarget,
  );

const submittedUsageDate =
  String(
    formData.get(
      "usageDate",
    ) ?? "",
  );

const submittedAcquisitionDate =
  String(
    formData.get(
      "acquisitionDate",
    ) ?? "",
  );

const submittedDocumentDate =
  String(
    formData.get(
      "documentDate",
    ) ?? "",
  );

    if (!id) {
      return;
    }

    if (
      !patrimonyNumber.trim() ||
      !description.trim()
    ) {
      setError(
        "Informe o tombo e a descrição do bem.",
      );

      return;
    }

    let parsedValue:
      | number
      | null =
      null;

    if (
      acquisitionValue.trim()
    ) {
      parsedValue =
        Number(
          acquisitionValue.replace(
            ",",
            ".",
          ),
        );

      if (
        Number.isNaN(
          parsedValue,
        ) ||
        parsedValue < 0
      ) {
        setError(
          "Informe um valor de aquisição válido.",
        );

        return;
      }
    }

    const input: AssetUpdate = {
      patrimonyNumber:
        patrimonyNumber.trim(),

      description:
        description.trim(),

      brand:
        optionalString(
          brand,
        ),

      model:
        optionalString(
          model,
        ),

      serialNumber:
        optionalString(
          serialNumber,
        ),

      room:
        optionalString(
          room,
        ),

      usageDate:
        optionalString(
          usageDate,
        ),

      acquisitionDate:
        optionalString(
          acquisitionDate,
        ),

      documentNumber:
        optionalString(
          documentNumber,
        ),

      documentDate:
        optionalString(
          documentDate,
        ),

      acquisitionValue:
        parsedValue,

      commitmentNumber:
        optionalString(
          commitmentNumber,
        ),

      conservationStatus:
        optionalString(
          conservationStatus,
        ),

      renavam:
        optionalString(
          renavam,
        ),

      chassis:
        optionalString(
          chassis,
        ),

      notes:
        optionalString(
          notes,
        ),
    };

    try {
      setSaving(true);
      setError("");

      await api<Asset>(
        `/api/assets/${id}`,
        {
          method:
            "PATCH",

          body:
            json(input),
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
          "Não foi possível atualizar o bem patrimonial.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-[var(--text-muted)]">
        Carregando bem patrimonial...
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
            Editar Bem Patrimonial
          </h1>

          <p className="text-sm text-[var(--text-muted)]">
            Atualize os dados
            cadastrais do bem.
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
          title="Não foi possível concluir a operação"
        >
          {error}
        </Alert>
      ) : null}

      <form
        className="space-y-6"
        onSubmit={
          handleSubmit
        }
      >
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-medium">
                Identificação
              </h2>

              <p className="text-xs text-[var(--text-muted)]">
                Dados principais
                do patrimônio.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Tombo"
                htmlFor="patrimonyNumber"
              >
                <Input
                  id="patrimonyNumber"
                  value={
                    patrimonyNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setPatrimonyNumber(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <FormField
                label="Marca"
                htmlFor="brand"
              >
                <Input
                  id="brand"
                  value={
                    brand
                  }
                  onChange={(
                    event,
                  ) =>
                    setBrand(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <FormField
                label="Modelo"
                htmlFor="model"
              >
                <Input
                  id="model"
                  value={
                    model
                  }
                  onChange={(
                    event,
                  ) =>
                    setModel(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <FormField
                label="Número de série"
                htmlFor="serialNumber"
              >
                <Input
                  id="serialNumber"
                  value={
                    serialNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setSerialNumber(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <FormField
                label="Conservação"
                htmlFor="conservationStatus"
              >
                <select
                  id="conservationStatus"
                  className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  value={
                    conservationStatus
                  }
                  onChange={(
                    event,
                  ) =>
                    setConservationStatus(
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Não informado
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

              <FormField
                label="Sala"
                htmlFor="room"
              >
                <Input
                  id="room"
                  value={
                    room
                  }
                  onChange={(
                    event,
                  ) =>
                    setRoom(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <div className="sm:col-span-2 lg:col-span-3">
                <FormField
                  label="Material / Descrição"
                  htmlFor="description"
                >
                  <Textarea
                    id="description"
                    value={
                      description
                    }
                    onChange={(
                      event,
                    ) =>
                      setDescription(
                        event.target
                          .value,
                      )
                    }
                  />
                </FormField>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-medium">
                Documentação e aquisição
              </h2>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Data de utilização"
                htmlFor="usageDate"
                >
                <DatePicker
                    id="usageDate"
                    name="usageDate"
                    defaultValue={
                    usageDate
                    }
                />
              </FormField>

              <FormField
                label="Data de aquisição"
                htmlFor="acquisitionDate"
                >
                <DatePicker
                    id="acquisitionDate"
                    name="acquisitionDate"
                    defaultValue={
                    acquisitionDate
                    }
                />
              </FormField>

                <FormField
                    label="Valor de aquisição"
                    htmlFor="acquisitionValue"
                >
                    <Input
                    id="acquisitionValue"
                    inputMode="decimal"
                    value={
                        acquisitionValue
                    }
                    onChange={(
                        event,
                    ) =>
                        setAcquisitionValue(
                        event.target
                            .value,
                        )
                    }
                    />
                </FormField>

                <FormField
                    label="Documento"
                    htmlFor="documentNumber"
                >
                    <Input
                    id="documentNumber"
                    value={
                        documentNumber
                    }
                    onChange={(
                        event,
                    ) =>
                        setDocumentNumber(
                        event.target
                            .value,
                        )
                    }
                    />
                 </FormField>

                <FormField
                label="Data do documento"
                htmlFor="documentDate"
                >
                <DatePicker
                    id="documentDate"
                    name="documentDate"
                    defaultValue={
                    documentDate
                    }
                />
                </FormField>

              <FormField
                label="Empenho"
                htmlFor="commitmentNumber"
              >
                <Input
                  id="commitmentNumber"
                  value={
                    commitmentNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommitmentNumber(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-medium">
                Informações complementares
              </h2>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="RENAVAM"
                htmlFor="renavam"
              >
                <Input
                  id="renavam"
                  value={
                    renavam
                  }
                  onChange={(
                    event,
                  ) =>
                    setRenavam(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <FormField
                label="Chassi"
                htmlFor="chassis"
              >
                <Input
                  id="chassis"
                  value={
                    chassis
                  }
                  onChange={(
                    event,
                  ) =>
                    setChassis(
                      event.target
                        .value,
                    )
                  }
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField
                  label="Observações"
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
                  />
                </FormField>
              </div>
            </div>
          </CardContent>
        </Card>

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
            <FloppyDisk
              size={18}
            />

            {saving
              ? "Salvando..."
              : "Salvar alterações"}
          </Button>
        </div>
      </form>
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