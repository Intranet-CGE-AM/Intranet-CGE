import { Badge } from "@cge/ui";
import { CalendarCheck2, Check, ShieldCheck, UsersRound } from "lucide-react";
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
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white">
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
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

      <aside className="hero-pattern relative hidden min-h-[100dvh] overflow-hidden bg-[var(--brand)] p-12 text-white lg:flex lg:items-center lg:justify-center">
        <div className="absolute left-12 top-12">
          <Badge className="border-white/10 bg-white/10 text-white">
            Plataforma interna
          </Badge>
        </div>
        <div className="relative w-full max-w-[560px]">
          <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 shadow-[0_30px_80px_rgb(0_30_34/28%)] backdrop-blur-sm">
            <div className="rounded-2xl bg-white p-5 text-[var(--text)]">
              <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <ShieldCheck aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className="text-sm font-extrabold">Portal CGE</p>
                  <p className="text-[11px] text-[var(--text-faint)]">
                    Serviços internos integrados
                  </p>
                </div>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-[var(--success)]">
                  <Check aria-hidden="true" size={14} />
                  Seguro
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--brand-soft)] p-4">
                  <UsersRound
                    aria-hidden="true"
                    className="text-[var(--brand)]"
                    size={20}
                  />
                  <p className="mt-6 text-xs font-semibold text-[var(--text-muted)]">
                    Pessoas e equipes
                  </p>
                  <p className="mt-1 text-xl font-extrabold">Diretório único</p>
                </div>
                <div className="rounded-2xl bg-[var(--action-soft)] p-4">
                  <CalendarCheck2
                    aria-hidden="true"
                    className="text-[var(--brand)]"
                    size={20}
                  />
                  <p className="mt-6 text-xs font-semibold text-[var(--text-muted)]">
                    Fluxos internos
                  </p>
                  <p className="mt-1 text-xl font-extrabold">Decisões claras</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-9 max-w-md text-center">
            <h2 className="text-2xl font-extrabold tracking-[-0.035em]">
              Um só lugar para o trabalho interno
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Pessoas, solicitações e administração com permissões granulares,
              rastreabilidade e uma identidade visual consistente.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
