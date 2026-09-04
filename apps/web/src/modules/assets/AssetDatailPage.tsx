import type {
  Asset,
} from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
} from "@cge/ui";

import {
  ArrowLeft,
} from "@phosphor-icons/react";

import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router";

import {
  api,
  ApiError,
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

const assetStatusLabels = {
  active: "Em uso",
  maintenance: "Em manutenção",
  disposed: "Baixado",
} as const;

export function AssetDetailPage() {
  const {
    id,
  } = useParams();

  const [
    asset,
    setAsset,
  ] = useState<Asset | null>(
    null,
  );

  const [
    unit,
    setUnit,
  ] =
    useState<OrganizationUnit | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

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

      const foundUnit =
        assetResult.unitId
          ? unitsResult.units.find(
              (item) =>
                item.id ===
                assetResult.unitId,
            ) ?? null
          : null;

      setUnit(
        foundUnit,
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
          "Não foi possível carregar os dados do bem patrimonial.",
        );
      }
    } finally {
      setLoading(false);
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
    error ||
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
          {error ||
            "Bem patrimonial não encontrado."}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-extrabold md:text-[30px]">
            Bem Patrimonial{" "}
            {asset.patrimonyNumber}
          </h1>

          <p className="text-sm text-[var(--text-muted)]">
            Consulte as informações
            completas do patrimônio.
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

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Identificação
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Dados de identificação
              do bem.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              label="Tombo"
              value={
                asset.patrimonyNumber
              }
            />

            <DetailItem
              label="Situação"
            >
              <Badge variant="neutral">
                {
                  assetStatusLabels[
                    asset.status
                  ]
                }
              </Badge>
            </DetailItem>

            <DetailItem
              label="Conservação"
              value={
                asset.conservationStatus
              }
            />

            <div className="sm:col-span-2 lg:col-span-3">
              <DetailItem
                label="Material / Descrição"
                value={
                  asset.description
                }
              />
            </div>

            <DetailItem
              label="Marca"
              value={
                asset.brand
              }
            />

            <DetailItem
              label="Modelo"
              value={
                asset.model
              }
            />

            <DetailItem
              label="Número de série"
              value={
                asset.serialNumber
              }
            />
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
              Localização atual
              do patrimônio.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <DetailItem
              label="Setor / Localização"
              value={
                unit
                  ? `${unit.code} - ${unit.name}`
                  : null
              }
            />

            <DetailItem
              label="Sala"
              value={
                asset.room
              }
            />
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
              Informações relacionadas
              à aquisição e documentação.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              label="Data de utilização"
              value={formatDate(
                asset.usageDate,
              )}
            />

            <DetailItem
              label="Data de aquisição"
              value={formatDate(
                asset.acquisitionDate,
              )}
            />

            <DetailItem
              label="Valor de aquisição"
              value={formatCurrency(
                asset.acquisitionValue,
              )}
            />

            <DetailItem
              label="Documento"
              value={
                asset.documentNumber
              }
            />

            <DetailItem
              label="Data do documento"
              value={formatDate(
                asset.documentDate,
              )}
            />

            <DetailItem
              label="Empenho"
              value={
                asset.commitmentNumber
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Informações complementares
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Dados adicionais
              do patrimônio.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <DetailItem
              label="RENAVAM"
              value={
                asset.renavam
              }
            />

            <DetailItem
              label="Chassi"
              value={
                asset.chassis
              }
            />

            <div className="sm:col-span-2">
              <DetailItem
                label="Observações"
                value={
                  asset.notes
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailItem({
  label,
  value,
  children,
}: {
  label: string;

  value?:
    | string
    | null;

  children?:
    React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>

      {children ?? (
        <p className="text-sm">
          {value || "—"}
        </p>
      )}
    </div>
  );
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const [
    year,
    month,
    day,
  ] = value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatCurrency(
  value:
    | number
    | string
    | null,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number =
    Number(value);

  if (
    Number.isNaN(number)
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  ).format(number);
}