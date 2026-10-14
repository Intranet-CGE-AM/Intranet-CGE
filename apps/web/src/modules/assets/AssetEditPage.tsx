import type { Asset, AssetUpdate } from "@cge/contracts";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  DatePicker,
  FormField,
  Input,
  Select,
  Textarea,
} from "@cge/ui";

import { type FormEvent, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { api, ApiError, json } from "../../lib/api";

import {
  conservationOptions,
  optionalString,
  PageHeader,
  PageSkeleton,
} from "./shared";

// Radix Select rejects "" as an item value, so "Não informado" uses a sentinel.
const NONE = "__none__";

const conservationSelectOptions = [
  { label: "Não informado", value: NONE },
  ...conservationOptions,
];

type FieldErrors = Partial<
  Record<"patrimonyNumber" | "description" | "acquisitionValue", string>
>;

export function AssetEditPage() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [asset, setAsset] = useState<Asset | null>(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});

  const [patrimonyNumber, setPatrimonyNumber] = useState("");

  const [description, setDescription] = useState("");

  const [brand, setBrand] = useState("");

  const [model, setModel] = useState("");

  const [serialNumber, setSerialNumber] = useState("");

  const [usageDate, setUsageDate] = useState("");

  const [acquisitionDate, setAcquisitionDate] = useState("");

  const [documentNumber, setDocumentNumber] = useState("");

  const [documentDate, setDocumentDate] = useState("");

  const [acquisitionValue, setAcquisitionValue] = useState("");

  const [commitmentNumber, setCommitmentNumber] = useState("");

  const [conservationStatus, setConservationStatus] = useState("");

  const [renavam, setRenavam] = useState("");

  const [chassis, setChassis] = useState("");

  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Identificador do bem não informado.");

      setLoading(false);

      return;
    }

    void loadAsset(id);
  }, [id]);

  async function loadAsset(assetId: string) {
    try {
      setLoading(true);
      setError("");

      const result = await api<Asset>(`/api/assets/${assetId}`);

      setAsset(result);

      setPatrimonyNumber(result.patrimonyNumber);

      setDescription(result.description);

      setBrand(result.brand ?? "");

      setModel(result.model ?? "");

      setSerialNumber(result.serialNumber ?? "");

      setUsageDate(result.usageDate ?? "");

      setAcquisitionDate(result.acquisitionDate ?? "");

      setDocumentNumber(result.documentNumber ?? "");

      setDocumentDate(result.documentDate ?? "");

      setAcquisitionValue(
        result.acquisitionValue !== null ? String(result.acquisitionValue) : "",
      );

      setCommitmentNumber(result.commitmentNumber ?? "");

      setConservationStatus(result.conservationStatus ?? "");

      setRenavam(result.renavam ?? "");

      setChassis(result.chassis ?? "");

      setNotes(result.notes ?? "");
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível carregar os dados do bem.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const submittedUsageDate = String(formData.get("usageDate") ?? "");

    const submittedAcquisitionDate = String(
      formData.get("acquisitionDate") ?? "",
    );

    const submittedDocumentDate = String(formData.get("documentDate") ?? "");

    if (!id) {
      return;
    }

    const nextErrors: FieldErrors = {};

    if (!patrimonyNumber.trim()) {
      nextErrors.patrimonyNumber = "Informe o número do tombo.";
    }

    if (!description.trim()) {
      nextErrors.description = "Informe a descrição do bem.";
    }

    let parsedValue: number | null = null;

    if (acquisitionValue.trim()) {
      parsedValue = Number(acquisitionValue.replace(",", "."));

      if (Number.isNaN(parsedValue) || parsedValue < 0) {
        nextErrors.acquisitionValue = "Informe um valor de aquisição válido.";
      }
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const input: AssetUpdate = {
      patrimonyNumber: patrimonyNumber.trim(),

      description: description.trim(),

      brand: optionalString(brand),

      model: optionalString(model),

      serialNumber: optionalString(serialNumber),

      usageDate: optionalString(submittedUsageDate),

      acquisitionDate: optionalString(submittedAcquisitionDate),

      documentNumber: optionalString(documentNumber),

      documentDate: optionalString(submittedDocumentDate),

      acquisitionValue: parsedValue,

      commitmentNumber: optionalString(commitmentNumber),

      conservationStatus: optionalString(conservationStatus),

      renavam: optionalString(renavam),

      chassis: optionalString(chassis),

      notes: optionalString(notes),
    };

    try {
      setSaving(true);
      setError("");

      await api<Asset>(`/api/assets/${id}`, {
        method: "PATCH",

        body: json(input),
      });

      navigate(`/patrimonio/bens/${id}`);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível atualizar o bem patrimonial.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageSkeleton label="Carregando bem patrimonial" />;
  }

  if (error && !asset) {
    return (
      <div className="page-enter space-y-5">
        <PageHeader backTo="/patrimonio/bens" title="Editar bem patrimonial" />

        <Alert tone="danger" title="Não foi possível carregar o bem">
          {error}
        </Alert>
      </div>
    );
  }

  if (!asset) {
    return null;
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        backTo={`/patrimonio/bens/${asset.id}`}
        description="Atualize os dados cadastrais do bem."
        title="Editar bem patrimonial"
      />

      {error ? (
        <Alert tone="danger" title="Não foi possível concluir a operação">
          {error}
        </Alert>
      ) : null}

      <Alert tone="neutral" title="Localização">
        Para alterar a localização do bem, use a ação Movimentar na página do
        bem.
      </Alert>

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
                  value={patrimonyNumber}
                  onChange={(event) => setPatrimonyNumber(event.target.value)}
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
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
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
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="brand" label="Marca (opcional)">
                <Input
                  id="brand"
                  name="brand"
                  placeholder="Ex.: APC"
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="model" label="Modelo (opcional)">
                <Input
                  id="model"
                  name="model"
                  placeholder="Modelo do bem"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
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
                  defaultValue={usageDate}
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
                  defaultValue={acquisitionDate}
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
                  value={documentNumber}
                  onChange={(event) => setDocumentNumber(event.target.value)}
                />
              </FormField>

              <FormField
                htmlFor="documentDate"
                label="Data do documento (opcional)"
              >
                <DatePicker
                  defaultValue={documentDate}
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
                  value={acquisitionValue}
                  onChange={(event) => setAcquisitionValue(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="commitmentNumber" label="Empenho (opcional)">
                <Input
                  id="commitmentNumber"
                  name="commitmentNumber"
                  placeholder="Ex.: 2021NE00045"
                  value={commitmentNumber}
                  onChange={(event) => setCommitmentNumber(event.target.value)}
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
                  value={renavam}
                  onChange={(event) => setRenavam(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="chassis" label="Chassi (opcional)">
                <Input
                  id="chassis"
                  name="chassis"
                  placeholder="Aplicável a veículos"
                  value={chassis}
                  onChange={(event) => setChassis(event.target.value)}
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
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="secondary">
            <Link to={`/patrimonio/bens/${asset.id}`}>Cancelar</Link>
          </Button>

          <Button disabled={saving} type="submit">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
