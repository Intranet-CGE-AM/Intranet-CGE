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
  Input,
  Textarea,
} from "@cge/ui";

import {
  ArrowLeft,
  TrashSimple,
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

export function AssetDisposalPage() {
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
    reason,
    setReason,
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
          "Não foi possível carregar o bem patrimonial.",
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

    if (
      !reason.trim()
    ) {
      setError(
        "Informe o motivo da baixa.",
      );

      return;
    }

    const formData =
      new FormData(
        event.currentTarget,
      );

    const disposalDate =
      String(
        formData.get(
          "disposalDate",
        ) ?? "",
      );

    if (!disposalDate) {
      setError(
        "Informe a data da baixa.",
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      await api(
        `/api/assets/${id}/disposal`,
        {
          method: "POST",

          body: json({
            disposalDate,

            reason:
              reason.trim(),

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
          "Não foi possível realizar a baixa patrimonial.",
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

  if (
    asset.status ===
    "disposed"
  ) {
    return (
      <div className="space-y-6">
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

        <Alert
          tone="neutral"
          title="Bem já baixado"
        >
          Este bem já possui baixa patrimonial.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Baixa Patrimonial
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
          title="Não foi possível concluir a baixa"
        >
          {error}
        </Alert>
      ) : null}

      <Alert
        tone="warning"
        title="Atenção"
      >
        A baixa patrimonial altera a
        situação do bem para baixado.
        Confirme os dados antes de
        continuar.
      </Alert>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Dados da baixa
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Informe a data e o motivo
              da baixa patrimonial.
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
                label="Data da baixa"
                htmlFor="disposalDate"
              >
                <DatePicker
                  id="disposalDate"
                  name="disposalDate"
                />
              </FormField>

              <FormField
                label="Motivo da baixa"
                htmlFor="reason"
              >
                <Input
                  id="reason"
                  value={
                    reason
                  }
                  onChange={(
                    event,
                  ) =>
                    setReason(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ex.: Bem inservível"
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
                    placeholder="Informações adicionais sobre a baixa..."
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
                variant="danger"
                disabled={
                  saving
                }
              >
                <TrashSimple
                  size={18}
                />

                {saving
                  ? "Realizando baixa..."
                  : "Confirmar baixa"}
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