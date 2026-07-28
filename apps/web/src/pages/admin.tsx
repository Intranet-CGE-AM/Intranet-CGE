import { Button, Card, CardContent, CardHeader } from "@cge/ui";
import {
  Building2,
  FileClock,
  KeyRound,
  ShieldCheck,
  Upload,
  UsersRound,
} from "lucide-react";

const areas = [
  {
    icon: UsersRound,
    title: "Pessoas e vínculos",
    description: "Cadastros, categorias, unidades e chefias.",
  },
  {
    icon: KeyRound,
    title: "Contas de acesso",
    description: "Provisionamento, redefinições e sessões.",
  },
  {
    icon: ShieldCheck,
    title: "Papéis e permissões",
    description: "Perfis editáveis e escopos por unidade.",
  },
  {
    icon: Building2,
    title: "Estrutura organizacional",
    description: "Unidades ativas e seus relacionamentos.",
  },
  {
    icon: Upload,
    title: "Importações",
    description: "Prévia, erros e histórico de arquivos CSV.",
  },
  {
    icon: FileClock,
    title: "Auditoria",
    description: "Eventos administrativos e exportação restrita.",
  },
];

export function AdminPage() {
  return (
    <div className="page-enter space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Acesso restrito
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
          Administração
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Configure o módulo de RH e acompanhe ações sensíveis.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => {
          const Icon = area.icon;
          return (
            <Card key={area.title}>
              <CardHeader className="border-0 pb-0">
                <div className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon aria-hidden="true" size={19} />
                </div>
              </CardHeader>
              <CardContent>
                <h2 className="font-bold">{area.title}</h2>
                <p className="mt-1 min-h-10 text-sm text-[var(--text-muted)]">
                  {area.description}
                </p>
                <Button variant="secondary" size="sm" className="mt-5">
                  Gerenciar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
