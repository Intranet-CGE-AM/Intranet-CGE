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
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CakeSlice,
  Check,
  Clock3,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

const requests = [
  {
    person: "Marina Oliveira",
    unit: "Auditoria Governamental",
    period: "12–26 ago",
    status: "Aguardando chefia",
    tone: "warning" as const,
  },
  {
    person: "Rafael Nascimento",
    unit: "Controle Interno",
    period: "02–16 set",
    status: "Análise final",
    tone: "brand" as const,
  },
  {
    person: "Lívia Souza",
    unit: "Ouvidoria",
    period: "08–22 jul",
    status: "Aprovada",
    tone: "success" as const,
  },
];

const birthdays = [
  { initials: "RM", name: "Ricardo Mendes", date: "Hoje", unit: "Tecnologia" },
  { initials: "JC", name: "Juliana Costa", date: "30 jul", unit: "Financeiro" },
  { initials: "PA", name: "Paula Almeida", date: "02 ago", unit: "Auditoria" },
];

export function DashboardPage() {
  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Terça-feira, 28 de julho
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
            Boa tarde, Ana
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Aqui está o resumo da equipe e das solicitações de hoje.
          </p>
        </div>
        <Button asChild>
          <Link to="/pessoas">
            <UserPlus aria-hidden="true" size={17} />
            Novo colaborador
          </Link>
        </Button>
      </div>

      <Card className="hero-pattern overflow-hidden border-0 bg-[var(--brand)] text-white">
        <CardContent className="flex min-h-[150px] flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-white/70">
              Pessoas ativas
            </p>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-[-0.05em]">
                128
              </span>
              <span className="mb-1 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-[var(--action)]">
                7 unidades
              </span>
            </div>
            <p className="mt-3 text-xs text-white/60">
              Base atualizada em 27 de julho às 16:42
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/ferias">
                <CalendarCheck2 aria-hidden="true" size={17} />
                Solicitar férias
              </Link>
            </Button>
            <Button
              asChild
              className="border-white/15 bg-white/10 text-white hover:bg-white/15"
              variant="secondary"
            >
              <Link to="/pessoas">
                <UsersRound aria-hidden="true" size={17} />
                Ver diretório
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: UsersRound,
            label: "Colaboradores ativos",
            value: "128",
            detail: "4 perfis atualizados",
          },
          {
            icon: CalendarClock,
            label: "Férias pendentes",
            value: "06",
            detail: "2 aguardam sua ação",
          },
          {
            icon: Check,
            label: "Aprovadas no mês",
            value: "14",
            detail: "Sem conflitos abertos",
          },
          {
            icon: Clock3,
            label: "Importação mais recente",
            value: "27 jul",
            detail: "126 linhas processadas",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="grid size-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Icon aria-hidden="true" size={18} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                    Agora
                  </span>
                </div>
                <p className="mt-5 text-sm font-semibold text-[var(--text-muted)]">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">
                  {item.value}
                </p>
                <p className="mt-3 text-xs text-[var(--text-faint)]">
                  {item.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.7fr)]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Solicitações recentes</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Férias que precisam de acompanhamento
              </p>
            </div>
            <Button asChild variant="quiet" size="sm">
              <Link to="/ferias">
                Ver todas
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </Button>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <TableHead>Colaborador</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <TableRow key={request.person}>
                  <TableCell>
                    <p className="font-semibold">{request.person}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                      {request.unit}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[var(--text-muted)]">
                    {request.period}
                  </TableCell>
                  <TableCell>
                    <Badge variant={request.tone}>{request.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CakeSlice
                aria-hidden="true"
                className="text-[var(--brand)]"
                size={18}
              />
              <h2 className="font-bold">Próximos aniversários</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {birthdays.map((birthday) => (
              <div className="flex items-center gap-3" key={birthday.name}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-xs font-extrabold text-[var(--brand)]">
                  {birthday.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{birthday.name}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {birthday.unit}
                  </p>
                </div>
                <Badge
                  variant={birthday.date === "Hoje" ? "success" : "neutral"}
                >
                  {birthday.date}
                </Badge>
              </div>
            ))}
            <p className="border-t border-[var(--border)] pt-4 text-xs leading-relaxed text-[var(--text-faint)]">
              Apenas pessoas que autorizaram a exibição aparecem aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
