import type { Asset, AssetMovement } from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";

import { Archive, ArrowsLeftRight, PencilSimple } from "@phosphor-icons/react";

import { useEffect, useState } from "react";

import { Link, useParams } from "react-router";

import { api, ApiError } from "../../lib/api";

import {
  assetStatusMeta,
  formatCurrency,
  formatDate,
  PageHeader,
  PageSkeleton,
  type OrganizationUnit,
  type OrganizationUnitsResponse,
  useCanManageAssets,
} from "./shared";

type AssetMovementsResponse = {
  movements: AssetMovement[];
};

type AssetDisposal = {
  id: string;
  assetId: string;
  disposalDate: string;
  reason: string;
  notes: string | null;
  createdAt: string;
};

type AssetDisposalResponse = {
  disposal: AssetDisposal;
};

export function AssetDetailPage() {
  const canManage = useCanManageAssets();
  const { id } = useParams();

  const [asset, setAsset] = useState<Asset | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [actionError, setActionError] = useState("");

  const [movements, setMovements] = useState<AssetMovement[]>([]);

  const [units, setUnits] = useState<OrganizationUnit[]>([]);

  const [changingStatus, setChangingStatus] = useState(false);

  const [disposal, setDisposal] = useState<AssetDisposal | null>(null);

  useEffect(() => {
    if (!id) {
      setLoadError("Identificador do bem não informado.");

      setLoading(false);

      return;
    }

    void loadAsset(id);
  }, [id]);

  async function loadAsset(assetId: string) {
    try {
      setLoading(true);
      setLoadError("");

      const [assetResult, unitsResult, movementsResult] = await Promise.all([
        api<Asset>(
          `/api/assets/${assetId}`, //Busca de Bem
        ),

        api<OrganizationUnitsResponse>(
          "/api/organization-units", // Busca de unidades organizacionais
        ),

        api<AssetMovementsResponse>(
          `/api/assets/${assetId}/movements`, //Busca de movimentações
        ),
      ]);

      setUnits(unitsResult.units);

      setAsset(assetResult);

      setMovements(movementsResult.movements);

      if (assetResult.status === "disposed") {
        const disposalResult = await api<AssetDisposalResponse>(
          `/api/assets/${assetId}/disposal`,
        );

        setDisposal(disposalResult.disposal);
      } else {
        setDisposal(null);
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setLoadError(cause.message);
      } else {
        setLoadError("Não foi possível carregar os dados do bem patrimonial.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <PageSkeleton label="Carregando bem patrimonial" />;
  }

  if (loadError || !asset) {
    return (
      <div className="page-enter space-y-5">
        <PageHeader title="Bem patrimonial" backTo="/patrimonio/bens" />

        <Alert tone="danger" title="Não foi possível carregar o bem">
          {loadError || "Bem patrimonial não encontrado."}
        </Alert>
      </div>
    );
  }

  const unitsById = new Map(units.map((unit) => [unit.id, unit]));

  const currentUnit = asset.unitId
    ? (unitsById.get(asset.unitId) ?? null)
    : null;

  let department: OrganizationUnit | null = null;

  let sector: OrganizationUnit | null = null;

  let subsector: OrganizationUnit | null = null;

  if (currentUnit?.type === "subsector") {
    subsector = currentUnit;

    sector = currentUnit.parentId
      ? (unitsById.get(currentUnit.parentId) ?? null)
      : null;

    department = sector?.parentId
      ? (unitsById.get(sector.parentId) ?? null)
      : null;
  } else if (currentUnit?.type === "sector") {
    // Compatibilidade com bens antigos.
    sector = currentUnit;

    department = currentUnit.parentId
      ? (unitsById.get(currentUnit.parentId) ?? null)
      : null;
  } else if (currentUnit?.type === "department") {
    // Compatibilidade com registros antigos.
    department = currentUnit;
  }

  async function handleStatusChange() {
    if (!asset) {
      return;
    }

    const newStatus = asset.status === "maintenance" ? "active" : "maintenance";

    try {
      setChangingStatus(true);
      setActionError("");

      const updated = await api<Asset>(`/api/assets/${asset.id}/status`, {
        method: "PATCH",

        body: JSON.stringify({
          status: newStatus,
        }),

        headers: {
          "Content-Type": "application/json",
        },
      });

      setAsset(updated);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setActionError(cause.message);
      } else {
        setActionError("Não foi possível alterar a situação do bem.");
      }
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        backTo="/patrimonio/bens"
        title={`Bem patrimonial ${asset.patrimonyNumber}`}
        description="Consulte as informações completas do patrimônio."
        actions={
          canManage && asset.status !== "disposed" ? (
            <>
              <Button asChild>
                <Link to={`/patrimonio/bens/${asset.id}/editar`}>
                  <PencilSimple aria-hidden="true" size={16} />
                  Editar
                </Link>
              </Button>

              <Button asChild variant="secondary">
                <Link to={`/patrimonio/bens/${asset.id}/movimentar`}>
                  <ArrowsLeftRight aria-hidden="true" size={16} />
                  Movimentar
                </Link>
              </Button>

              <Button asChild variant="danger">
                <Link to={`/patrimonio/bens/${asset.id}/baixa`}>
                  <Archive aria-hidden="true" size={16} />
                  Baixar
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      {actionError ? (
        <Alert tone="danger" title="Não foi possível alterar a situação">
          {actionError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Identificação</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Dados de identificação do bem.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Número do tombo" value={asset.patrimonyNumber} />

            <DetailItem label="Situação">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={assetStatusMeta[asset.status].variant}>
                  {assetStatusMeta[asset.status].label}
                </Badge>

                {canManage && asset.status !== "disposed" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={changingStatus}
                    onClick={() => void handleStatusChange()}
                  >
                    {changingStatus
                      ? "Atualizando..."
                      : asset.status === "maintenance"
                        ? "Retornar ao uso"
                        : "Enviar para manutenção"}
                  </Button>
                ) : null}
              </div>
            </DetailItem>

            <DetailItem label="Conservação" value={asset.conservationStatus} />

            <div className="sm:col-span-2 lg:col-span-3">
              <DetailItem
                label="Material / descrição"
                value={asset.description}
              />
            </div>

            <DetailItem label="Marca" value={asset.brand} />

            <DetailItem label="Modelo" value={asset.model} />

            <DetailItem label="Número de série" value={asset.serialNumber} />
          </div>
        </CardContent>
      </Card>

      {asset.status === "disposed" && disposal ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Baixa patrimonial</h2>

              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Informações registradas no processo de baixa do bem.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem
                label="Data da baixa"
                value={formatDate(disposal.disposalDate)}
              />

              <div className="sm:col-span-2">
                <DetailItem label="Motivo da baixa" value={disposal.reason} />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <DetailItem label="Observação" value={disposal.notes} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Localização</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Localização atual do patrimônio.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailItem
              label="Departamento"
              value={
                department ? `${department.code} - ${department.name}` : null
              }
            />

            <DetailItem
              label="Setor"
              value={sector ? `${sector.code} - ${sector.name}` : null}
            />

            <DetailItem
              label="Subsetor"
              value={subsector ? `${subsector.code} - ${subsector.name}` : null}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Nota fiscal, documentação e aquisição</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Informações relacionadas à aquisição e documentação.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              label="Data de utilização"
              value={formatDate(asset.usageDate)}
            />

            <DetailItem
              label="Data de aquisição"
              value={formatDate(asset.acquisitionDate)}
            />

            <DetailItem
              label="Valor de aquisição"
              value={formatCurrency(asset.acquisitionValue)}
            />

            <DetailItem label="Documento" value={asset.documentNumber} />

            <DetailItem
              label="Data do documento"
              value={formatDate(asset.documentDate)}
            />

            <DetailItem label="Empenho" value={asset.commitmentNumber} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Informações complementares</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Dados adicionais do patrimônio.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="RENAVAM" value={asset.renavam} />

            <DetailItem label="Chassi" value={asset.chassis} />

            <div className="sm:col-span-2">
              <DetailItem label="Observações" value={asset.notes} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Histórico de movimentações</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Transferências realizadas entre unidades organizacionais.
            </p>
          </div>
        </CardHeader>

        {movements.length === 0 ? (
          <EmptyState
            title="Nenhuma movimentação registrada"
            description="As transferências deste bem aparecerão aqui."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <TableHead>Data</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Observação</TableHead>
              </tr>
            </thead>
            <tbody>
              {[...movements].reverse().map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDate(movement.movementDate)}</TableCell>
                  <TableCell>
                    {formatUnitPath(movement.fromUnitId, unitsById)}
                  </TableCell>
                  <TableCell>
                    {formatUnitPath(movement.toUnitId, unitsById)}
                  </TableCell>
                  <TableCell>{movement.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
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

  value?: string | null;

  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </p>

      {children ?? <p className="text-sm">{value || "—"}</p>}
    </div>
  );
}

function formatUnitPath(
  unitId: string | null,
  unitsById: Map<string, OrganizationUnit>,
) {
  if (!unitId) {
    return "Sem localização anterior";
  }

  const parts: string[] = [];
  const visited = new Set<string>();

  let current = unitsById.get(unitId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    parts.unshift(current.code || current.name || "Unidade");

    current = current.parentId ? unitsById.get(current.parentId) : undefined;
  }

  return parts.length
    ? parts.join(" > ")
    : "Unidade organizacional não encontrada";
}
