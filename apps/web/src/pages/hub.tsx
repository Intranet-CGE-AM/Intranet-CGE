import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DashboardBanner,
} from "@cge/ui";
import { ArrowRight, Files, Megaphone, Monitor } from "@phosphor-icons/react";
import { Link } from "react-router";

import { useAuth } from "../auth";
import {
  availableModules,
  availableSystemNavigation,
  canNavigate,
} from "../navigation";

const today = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  timeZone: "America/Manaus",
  weekday: "long",
});

const futureSpaces = [
  {
    description: "Avisos e notícias da instituição",
    icon: Megaphone,
    label: "Mural e comunicados",
  },
  {
    description: "Normas, manuais e formulários",
    icon: Files,
    label: "Documentos internos",
  },
  {
    description: "Atalhos para os sistemas da CGE",
    icon: Monitor,
    label: "Sistemas e serviços",
  },
] as const;

export function HubPage() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  const modules = availableModules(user);
  const systemItems = availableSystemNavigation(user);
  const primaryModule = modules[0];
  const moduleRoutes =
    primaryModule?.routes.filter(
      (route) => canNavigate(user, route) && !route.end,
    ) ?? [];
  const workLinks = [...moduleRoutes, ...systemItems];
  const firstName = user.person.displayName.split(/\s+/)[0];

  return (
    <div className="hub-page space-y-6 pb-6">
      <header className="pt-2" data-reveal>
        <p className="text-xs font-semibold capitalize text-[var(--text-faint)]">
          {today.format(new Date())} · Manaus
        </p>
        <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-[-0.045em] sm:text-[38px]">
          Bom dia, {firstName}
        </h1>
      </header>

      <DashboardBanner
        action={
          primaryModule ? (
            <Button asChild size="sm" variant="quiet">
              <Link
                className="!min-h-0 !justify-start !p-0 text-[var(--brand)] hover:!bg-transparent"
                to={primaryModule.href}
              >
                Acessar {primaryModule.label}
                <ArrowRight aria-hidden="true" size={15} weight="bold" />
              </Link>
            </Button>
          ) : undefined
        }
        artwork={
          <img
            alt=""
            className="h-full w-full origin-right scale-[1.3] object-contain object-right"
            fetchPriority="high"
            src="/assets/dashboard/intranet-workspace.webp"
          />
        }
        data-reveal
        description={
          primaryModule
            ? "Acesse serviços, informações internas e os módulos liberados para a sua conta."
            : "Sua conta ainda não recebeu acesso a módulos. Procure a administração da intranet se isso não estiver correto."
        }
        eyebrow="Intranet CGE"
        title={
          primaryModule
            ? "Seu trabalho começa aqui"
            : "Nenhum módulo está disponível"
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-2" data-reveal>
        <div className="space-y-5">
          <Card aria-labelledby="modules-title">
            <CardHeader>
              <div>
                <h2 className="font-extrabold" id="modules-title">
                  Seus módulos
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Áreas liberadas para o seu perfil
                </p>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--border)] p-0">
              {modules.length ? (
                modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <section
                      aria-labelledby={`module-${module.id}`}
                      className="flex items-center gap-4 px-5 py-5"
                      key={module.id}
                    >
                      <Icon
                        aria-hidden="true"
                        className="shrink-0 text-[var(--brand)]"
                        size={26}
                      />
                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-sm font-bold"
                          id={`module-${module.id}`}
                        >
                          {module.label}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                          {module.description}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="secondary">
                        <Link to={module.href}>Entrar no módulo</Link>
                      </Button>
                    </section>
                  );
                })
              ) : (
                <p className="px-5 py-8 text-sm text-[var(--text-muted)]">
                  Nenhum módulo foi liberado para a sua conta.
                </p>
              )}
            </CardContent>
          </Card>

          <Card aria-labelledby="account-context-title">
            <CardHeader>
              <div>
                <h2 className="font-extrabold" id="account-context-title">
                  Contexto da conta
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Dados usados para definir seu escopo
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--text-faint)]">
                    Unidade de lotação
                  </dt>
                  <dd className="mt-1 font-bold">
                    {user.employment?.unit.name ?? "Sem vínculo ativo"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-faint)]">
                    Categoria funcional
                  </dt>
                  <dd className="mt-1 font-bold">
                    {user.employment?.category.name ?? "Não informada"}
                  </dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-[var(--text-faint)]">
                    Conta institucional
                  </dt>
                  <dd className="mt-1 truncate font-bold">
                    {user.account.email}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card aria-labelledby="routine-title">
            <CardHeader>
              <div>
                <h2 className="font-extrabold" id="routine-title">
                  Minha rotina ({workLinks.length})
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Ações disponíveis para a sua conta
                </p>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--border)] p-0">
              {workLinks.length ? (
                workLinks.map((item) => {
                  const Icon = item.icon;
                  const isModuleRoute = moduleRoutes.includes(item);
                  return (
                    <div
                      className="flex items-center gap-4 px-5 py-4"
                      key={item.href}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                        <Icon aria-hidden="true" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{item.label}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {isModuleRoute
                            ? `Abrir em ${primaryModule?.label}`
                            : "Configuração da plataforma"}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="secondary">
                        <Link to={item.href}>Abrir</Link>
                      </Button>
                    </div>
                  );
                })
              ) : (
                <p className="px-5 py-8 text-sm text-[var(--text-muted)]">
                  Nenhuma ação está disponível no momento.
                </p>
              )}
            </CardContent>
          </Card>

          <Card aria-labelledby="future-title">
            <CardHeader>
              <div>
                <h2 className="font-extrabold" id="future-title">
                  Próximos espaços
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Conteúdos previstos para a intranet
                </p>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--border)] p-0">
              {futureSpaces.map((space) => {
                const Icon = space.icon;
                return (
                  <div
                    className="flex items-center gap-4 px-5 py-4"
                    key={space.label}
                  >
                    <Icon
                      aria-hidden="true"
                      className="shrink-0 text-[var(--text-muted)]"
                      size={20}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{space.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {space.description}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-faint)]">
                      Em breve
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
