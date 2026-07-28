import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import { Download, Plus, Search, Upload } from "lucide-react";

const people = [
  ["Marina Oliveira", "Auditoria Governamental", "Servidora efetiva", "Ativa"],
  ["Rafael Nascimento", "Controle Interno", "Cargo comissionado", "Ativo"],
  ["Lívia Souza", "Ouvidoria", "Servidora efetiva", "Ativa"],
  ["Caio Martins", "Tecnologia", "Terceirizado", "Ativo"],
];

export function PeoplePage() {
  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Colaboradores
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Diretório e vínculos funcionais ativos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">
            <Upload aria-hidden="true" size={16} />
            Importar CSV
          </Button>
          <Button>
            <Plus aria-hidden="true" size={16} />
            Novo colaborador
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              size={16}
            />
            <Input
              type="search"
              aria-label="Buscar colaboradores"
              placeholder="Nome, unidade ou categoria"
              className="pl-9"
            />
          </div>
          <Button variant="quiet" size="sm">
            <Download aria-hidden="true" size={15} />
            Exportar
          </Button>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Situação</TableHead>
            </tr>
          </thead>
          <tbody>
            {people.map(([name, unit, category, status]) => (
              <TableRow key={name}>
                <TableCell className="font-semibold">{name}</TableCell>
                <TableCell>{unit}</TableCell>
                <TableCell className="text-[var(--text-muted)]">
                  {category}
                </TableCell>
                <TableCell>
                  <Badge variant="success">{status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        <CardContent className="border-t border-[var(--border)] py-3 text-xs text-[var(--text-faint)]">
          Exibindo 4 de 128 colaboradores
        </CardContent>
      </Card>
    </div>
  );
}
