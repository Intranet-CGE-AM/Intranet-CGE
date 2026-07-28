import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import { CalendarPlus, Info } from "lucide-react";

export function VacationsPage() {
  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Férias
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Solicitações e decisões internas, sem cálculo de saldo.
          </p>
        </div>
        <Button>
          <CalendarPlus aria-hidden="true" size={17} />
          Nova solicitação
        </Button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-4 text-sm text-[var(--brand-strong)]">
        <div className="flex gap-3">
          <Info aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>
            A intranet organiza solicitações e decisões. O registro funcional e
            o saldo oficial permanecem no sistema de pessoal competente.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Minhas solicitações</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Histórico do vínculo funcional ativo
            </p>
          </div>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <TableHead>Período</TableHead>
              <TableHead>Etapa atual</TableHead>
              <TableHead>Atualização</TableHead>
            </tr>
          </thead>
          <tbody>
            <TableRow>
              <TableCell className="font-semibold">12–26 ago 2026</TableCell>
              <TableCell>
                <Badge variant="warning">Aguardando chefia</Badge>
              </TableCell>
              <TableCell className="text-[var(--text-muted)]">
                Hoje, 10:14
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold">08–22 jan 2026</TableCell>
              <TableCell>
                <Badge variant="success">Aprovada</Badge>
              </TableCell>
              <TableCell className="text-[var(--text-muted)]">
                18 nov 2025
              </TableCell>
            </TableRow>
          </tbody>
        </Table>
        <CardContent className="border-t border-[var(--border)] text-xs text-[var(--text-faint)]">
          A autoridade final é definida por permissão e pode ser delegada pela
          administração.
        </CardContent>
      </Card>
    </div>
  );
}
