import { Avatar, Button } from "@cge/ui";
import { ArrowRight, CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { Link } from "react-router";

import { useAuth } from "../auth";
import { availableModules, availableSystemNavigation } from "../navigation";

const today = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  timeZone: "America/Manaus",
  weekday: "long",
});

export function HubPage() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  const modules = availableModules(user);
  const systemItems = availableSystemNavigation(user);
  const primaryModule = modules[0];
  const otherModules = modules.slice(1);
  const firstName = user.person.displayName.split(/\s+/)[0];
  const primaryRoutes =
    primaryModule?.routes.filter(
      (route) => route.visible(user) && !route.end,
    ) ?? [];

  return (
    <div className="hub-page space-y-7 pb-6 md:space-y-9">
      <header
        className="grid gap-6 pt-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-end"
        data-reveal
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            <span className="capitalize">{today.format(new Date())}</span>
            <span aria-hidden="true" className="mx-2 text-[var(--border)]">
              /
            </span>
            Manaus
          </p>
          <h1 className="mt-3 max-w-3xl text-[34px] font-extrabold leading-[1.04] tracking-[-0.055em] sm:text-[42px]">
            Olá, {firstName}.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            Seus módulos e ferramentas aparecem aqui de acordo com o acesso
            concedido à sua conta.
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--border)] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <Avatar
            className="shrink-0 bg-white"
            name={user.person.displayName}
            size="lg"
            src={user.person.avatarUrl}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {user.person.displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              {user.employment?.jobTitle ??
                user.employment?.unit.name ??
                "Sem vínculo ativo"}
            </p>
          </div>
        </div>
      </header>

      <section
        aria-labelledby="primary-module-title"
        className="relative overflow-hidden rounded-[18px] bg-[var(--brand)] text-white shadow-[0_18px_45px_-30px_rgb(4_75_78/65%)]"
        data-reveal
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 size-[360px] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-20 size-[250px] rounded-full border border-white/10"
        />

        <div className="relative grid min-h-[280px] lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">
                {primaryModule
                  ? "Disponível para sua conta"
                  : "Acesso à plataforma"}
              </p>
              <h2
                className="mt-4 max-w-2xl text-3xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-[40px]"
                id="primary-module-title"
              >
                {primaryModule?.label ?? "Nenhum módulo está disponível"}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
                {primaryModule?.description ??
                  "Sua conta ainda não recebeu acesso a módulos. Procure a administração da intranet se isso não estiver correto."}
              </p>
            </div>

            {primaryModule ? (
              <div className="mt-8">
                <Button asChild>
                  <Link to={primaryModule.href}>
                    Entrar no módulo
                    <ArrowRight aria-hidden="true" size={17} weight="bold" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/15 bg-white/[0.045] p-6 shadow-[inset_0_1px_0_rgb(255_255_255/6%)] sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="hub-auth-pulse size-1.5 rounded-full bg-[var(--action)]"
                />
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">
                  Acesso autenticado
                </p>
              </div>

              {primaryRoutes.length ? (
                <nav aria-label={`Atalhos de ${primaryModule?.label}`}>
                  <p className="mt-8 text-xs font-semibold text-white/80">
                    Ir direto para
                  </p>
                  <div className="mt-2 divide-y divide-white/12 border-y border-white/12">
                    {primaryRoutes.map((route) => {
                      const Icon = route.icon;
                      return (
                        <Link
                          className="group flex min-h-14 items-center gap-3 text-sm font-semibold text-white/85 transition-[color,transform] duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[var(--focus)] active:translate-y-px"
                          key={route.href}
                          to={route.href}
                        >
                          <Icon aria-hidden="true" size={18} />
                          <span>{route.label}</span>
                          <ArrowRight
                            aria-hidden="true"
                            className="ml-auto transition-transform duration-200 group-hover:translate-x-1"
                            size={15}
                            weight="bold"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </nav>
              ) : (
                <div className="mt-auto pt-10">
                  <ShieldCheck
                    aria-hidden="true"
                    className="text-white/55"
                    size={28}
                  />
                  <p className="mt-3 text-sm font-semibold">Conta protegida</p>
                  <p className="mt-1 text-xs leading-5 text-white/80">
                    A navegação mostra somente áreas autorizadas para o seu
                    perfil.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {otherModules.length || systemItems.length ? (
        <div
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:gap-12"
          data-reveal
        >
          <section aria-labelledby="other-modules-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-faint)]">
                  Plataforma
                </p>
                <h2
                  className="mt-1 text-xl font-extrabold tracking-[-0.035em]"
                  id="other-modules-title"
                >
                  {otherModules.length ? "Outros módulos" : "Seu acesso hoje"}
                </h2>
              </div>
              <p className="text-xs font-semibold text-[var(--text-faint)]">
                {modules.length} {modules.length === 1 ? "módulo" : "módulos"}
              </p>
            </div>

            {otherModules.length ? (
              <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {otherModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link
                      className="group grid gap-3 py-5 transition-colors hover:text-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-center"
                      key={module.id}
                      to={module.href}
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-[var(--brand)]"
                        size={21}
                      />
                      <span>
                        <span className="block text-sm font-bold">
                          {module.label}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {module.description}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="text-[var(--text-faint)] transition-transform duration-200 group-hover:translate-x-1"
                        size={16}
                        weight="bold"
                      />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 border-y border-[var(--border)] py-5">
                <div className="flex items-start gap-3">
                  <CheckCircle
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-[var(--brand)]"
                    size={20}
                    weight="fill"
                  />
                  <div>
                    <p className="text-sm font-bold">
                      Navegação ajustada ao seu perfil
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                      Novos módulos aparecerão aqui quando forem liberados pela
                      administração.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {systemItems.length ? (
            <section aria-labelledby="system-tools-title">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-faint)]">
                Sistema
              </p>
              <h2
                className="mt-1 text-xl font-extrabold tracking-[-0.035em]"
                id="system-tools-title"
              >
                Ferramentas da plataforma
              </h2>
              <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {systemItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      className="group flex min-h-16 items-center gap-3 text-sm font-semibold transition-colors hover:text-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]"
                      key={item.href}
                      to={item.href}
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-[var(--brand)]"
                        size={20}
                      />
                      {item.label}
                      <ArrowRight
                        aria-hidden="true"
                        className="ml-auto text-[var(--text-faint)] transition-transform duration-200 group-hover:translate-x-1"
                        size={16}
                        weight="bold"
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <section
        aria-labelledby="account-context-title"
        className="border-t border-[var(--border)] pt-5"
        data-reveal
      >
        <h2 className="sr-only" id="account-context-title">
          Contexto da conta
        </h2>
        <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-[var(--text-faint)]">
              Unidade de lotação
            </dt>
            <dd className="mt-1 font-bold">
              {user.employment?.unit.name ?? "Sem vínculo ativo"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--text-faint)]">
              Categoria funcional
            </dt>
            <dd className="mt-1 font-bold">
              {user.employment?.category.name ?? "Não informada"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-[var(--text-faint)]">
              Conta institucional
            </dt>
            <dd className="mt-1 truncate font-bold">{user.account.email}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
