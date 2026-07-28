import {
  CalendarCheck,
  Check,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function AuthLayout({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="min-h-[100dvh] bg-white lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
      <section className="flex min-h-[100dvh] flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
        <div className="flex items-center gap-3">
          <ShieldCheck
            aria-hidden="true"
            className="text-[var(--brand)]"
            size={30}
            weight="fill"
          />
          <div>
            <p className="font-extrabold tracking-[-0.03em] text-[var(--brand-strong)]">
              CGE Amazonas
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              Intranet
            </p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[470px] flex-1 items-center py-12">
          <div className="w-full">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand)]">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {description}
            </p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        <p className="mx-auto max-w-lg text-center text-xs leading-5 text-[var(--text-faint)]">
          Ambiente interno da Controladoria-Geral do Estado do Amazonas. O
          acesso e as ações administrativas são registrados para segurança.
        </p>
      </section>

      <aside className="relative hidden min-h-[100dvh] overflow-hidden bg-[var(--brand)] p-12 text-white lg:flex lg:items-center">
        <div className="auth-grid absolute inset-0 opacity-35" />
        <div className="relative mx-auto w-full max-w-[620px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">
            Plataforma interna
          </p>
          <h2 className="mt-5 max-w-lg text-4xl font-extrabold leading-[1.08] tracking-[-0.05em]">
            Trabalho público com contexto, controle e rastreabilidade.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/65">
            Pessoas, solicitações e administração compartilham a mesma base de
            acesso sem depender de serviços externos.
          </p>

          <div className="mt-14 border-y border-white/15">
            {[
              {
                index: "01",
                label: "Diretório funcional",
                detail: "Pessoas, vínculos e unidades",
                icon: UsersThree,
              },
              {
                index: "02",
                label: "Decisões rastreáveis",
                detail: "Chefia e validação final",
                icon: CalendarCheck,
              },
              {
                index: "03",
                label: "Acesso sob controle",
                detail: "Papéis globais e por unidade",
                icon: ShieldCheck,
              },
            ].map(({ detail, icon: Icon, index, label }) => (
              <div
                className="grid grid-cols-[36px_1fr_auto] items-center gap-4 border-b border-white/15 py-5 last:border-0"
                key={index}
              >
                <span className="font-mono text-xs text-white/40">{index}</span>
                <div>
                  <p className="text-sm font-bold">{label}</p>
                  <p className="mt-0.5 text-xs text-white/50">{detail}</p>
                </div>
                <Icon aria-hidden="true" className="text-white/55" size={22} />
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs font-semibold text-white/55">
            <Check aria-hidden="true" size={15} weight="bold" />
            Operação restrita à rede institucional
          </p>
        </div>
      </aside>
    </main>
  );
}
