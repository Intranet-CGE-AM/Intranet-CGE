import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router";

import { useAuth } from "../auth";
import { availableModules, availableSystemNavigation } from "../navigation";

export function HubPage() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  const modules = availableModules(user);
  const systemItems = availableSystemNavigation(user);
  const firstName = user.person.displayName.split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Intranet CGE
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
          Olá, {firstName}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
          Escolha um módulo para acessar as ferramentas disponíveis para a sua
          conta.
        </p>
      </header>

      <section className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-bold">Módulos disponíveis</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Cada módulo reúne seus próprios fluxos, permissões e navegação.
          </p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {modules.length === 0 ? (
            <div className="px-5 py-8">
              <p className="text-sm font-semibold">
                Nenhum módulo está disponível
              </p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                Sua conta ainda não recebeu acesso a módulos. Procure a
                administração da intranet se isso não estiver correto.
              </p>
            </div>
          ) : null}
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                className="group grid gap-4 px-5 py-5 transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[var(--focus)] sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center"
                key={module.id}
                to={module.href}
              >
                <Icon
                  aria-hidden="true"
                  className="text-[var(--brand)]"
                  size={23}
                />
                <span>
                  <span className="block font-bold">{module.label}</span>
                  <span className="mt-1 block text-sm text-[var(--text-muted)]">
                    {module.description}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-strong)]">
                  Abrir módulo
                  <ArrowRight
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                    size={16}
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {systemItems.length ? (
        <section>
          <h2 className="text-sm font-bold">Ferramentas da plataforma</h2>
          <div className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {systemItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="flex items-center gap-3 py-4 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]"
                  key={item.href}
                  to={item.href}
                >
                  <Icon aria-hidden="true" size={19} />
                  {item.label}
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-auto"
                    size={15}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
