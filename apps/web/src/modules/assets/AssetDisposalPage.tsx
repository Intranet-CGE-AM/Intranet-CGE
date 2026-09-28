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
  Textarea,
} from "@cge/ui";

import { type FormEvent, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { api, ApiError, json } from "../../lib/api";

import { optionalString, PageHeader, PageSkeleton } from "./shared";

export function AssetDisposalPage() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [asset, setAsset] = useState<Asset | null>(null);

  const [reason, setReason] = useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível carregar o bem patrimonial.");
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

    const disposalDate = String(formData.get("disposalDate") ?? "");

    const errors: Record<string, string> = {};

    if (!disposalDate) {
      errors.disposalDate = "Informe a data da baixa.";
    }

    if (!reason.trim()) {
      errors.reason = "Informe o motivo da baixa.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setFieldErrors({});

      await api(`/api/assets/${id}/disposal`, {
        method: "POST",

        body: json({
          disposalDate,

          reason: reason.trim(),

          notes: optionalString(notes),
        }),
      });

      navigate(`/patrimonio/bens/${id}`);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível realizar a baixa patrimonial.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageSkeleton label="Carregando bem patrimonial" />;
  }

  if (!asset) {
    return (
      <div className="page-enter space-y-5">
        <PageHeader title="Baixa patrimonial" backTo="/patrimonio/bens" />

        <Alert tone="danger" title="Não foi possível carregar o bem">
          {error || "Bem patrimonial não encontrado."}
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        backTo={`/patrimonio/bens/${asset.id}`}
        title="Baixa patrimonial"
        description={`Tombo ${asset.patrimonyNumber}`}
      />

      {asset.status === "disposed" ? (
        <Alert tone="neutral" title="Bem já baixado">
          Este bem já possui baixa patrimonial.
        </Alert>
      ) : (
        <>
          {error ? (
            <Alert tone="danger" title="Não foi possível concluir a baixa">
              {error}
            </Alert>
          ) : null}

          <Alert tone="warning" title="A baixa muda a situação do bem">
            Ao confirmar, o bem passa para a situação Baixado e o motivo fica
            registrado no histórico dele.
          </Alert>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Dados da baixa</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Informe a data e o motivo da baixa patrimonial.
                </p>
              </div>
            </CardHeader>

            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Data da baixa"
                    htmlFor="disposalDate"
                    error={fieldErrors.disposalDate}
                  >
                    <DatePicker
                      aria-invalid={Boolean(fieldErrors.disposalDate)}
                      id="disposalDate"
                      name="disposalDate"
                      required
                    />
                  </FormField>

                  <FormField
                    label="Motivo da baixa"
                    htmlFor="reason"
                    error={fieldErrors.reason}
                  >
                    <Input
                      id="reason"
                      aria-invalid={Boolean(fieldErrors.reason)}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Ex.: Bem inservível"
                      required
                    />
                  </FormField>

                  <FormField
                    className="sm:col-span-2"
                    label="Observação (opcional)"
                    htmlFor="notes"
                  >
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Informações adicionais sobre a baixa..."
                    />
                  </FormField>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button asChild variant="secondary">
                    <Link to={`/patrimonio/bens/${asset.id}`}>Cancelar</Link>
                  </Button>

                  <Button type="submit" variant="danger" disabled={saving}>
                    {saving ? "Realizando baixa..." : "Confirmar baixa"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
