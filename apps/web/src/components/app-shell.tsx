import { Button } from "@cge/ui";
import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth";
import { can } from "../lib/permissions";

const navigation = [
  {
    label: "Início",
    href: "/",
    icon: LayoutDashboard,
    end: true,
    visible: () => true,
  },
  {
    label: "Colaboradores",
    href: "/pessoas",
    icon: UsersRound,
    visible: (user: NonNullable<ReturnType<typeof useAuth>["user"]>) =>
      can(user, "people.read"),
  },
  {
    label: "Férias",
    href: "/ferias",
    icon: CalendarDays,
    visible: (user: NonNullable<ReturnType<typeof useAuth>["user"]>) =>
      can(user, "vacations.create") ||
      can(user, "vacations.review.supervisor") ||
      can(user, "vacations.review.final"),
  },
  {
    label: "Administração",
    href: "/administracao",
    icon: Settings2,
    visible: (user: NonNullable<ReturnType<typeof useAuth>["user"]>) =>
      can(user, "accounts.manage") ||
      can(user, "access.manage") ||
      can(user, "audit.read"),
  },
] as const;

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-white">
        <ShieldCheck aria-hidden="true" size={21} strokeWidth={2.2} />
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold tracking-[-0.03em] text-[var(--brand-strong)]">
            CGE Amazonas
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            Intranet
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Navigation({
  collapsed = false,
  user,
}: {
  collapsed?: boolean;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  return (
    <nav aria-label="Navegação principal" className="mt-8 space-y-1">
      {!collapsed ? (
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Geral
        </p>
      ) : null}
      {navigation
        .filter((item) => item.visible(user))
        .map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={"end" in item && item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  "flex min-h-10 items-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  isActive
                    ? "border border-[var(--border)] bg-white text-[var(--brand)] shadow-[0_4px_12px_rgb(16_35_38/4%)]"
                    : "border border-transparent text-[var(--text-muted)] hover:bg-white/70 hover:text-[var(--text)]",
                ].join(" ")
              }
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
              {!collapsed ? <span>{item.label}</span> : null}
            </NavLink>
          );
        })}
    </nav>
  );
}

export function AppShell() {
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) {
    return null;
  }
  const initials = user.person.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
      <a
        href="#conteudo"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
      >
        Ir para o conteúdo
      </a>

      <aside
        className={[
          "sticky top-0 hidden h-screen border-r border-[var(--border)] bg-[#f7f8f8] p-3 transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-[76px]" : "w-[248px]",
        ].join(" ")}
      >
        <div className={collapsed ? "px-1 pt-1" : "px-2 pt-1"}>
          <Logo collapsed={collapsed} />
          <Navigation collapsed={collapsed} user={user} />
        </div>
        <div className="mt-auto">
          <Button
            variant="quiet"
            size={collapsed ? "icon" : "md"}
            className={collapsed ? "mx-auto flex" : "w-full justify-start"}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" size={18} />
            ) : (
              <>
                <PanelLeftClose aria-hidden="true" size={18} />
                Recolher menu
              </>
            )}
          </Button>
          <button
            className={[
              "mt-2 flex w-full items-center rounded-xl border border-[var(--border)] bg-white p-2 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]",
              collapsed ? "justify-center" : "gap-3",
            ].join(" ")}
            type="button"
            onClick={() => void logout()}
            aria-label={`Sair da conta de ${user.person.displayName}`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-xs font-extrabold text-[var(--brand)]">
              {initials}
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {user.person.displayName}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--text-faint)]">
                    {user.employment?.unit.name ?? "Sem vínculo ativo"}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="text-[var(--text-faint)]"
                  size={14}
                />
              </>
            ) : null}
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu ao clicar fora"
            type="button"
          />
          <aside className="relative h-full w-[280px] border-r border-[var(--border)] bg-[#f7f8f8] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <Logo />
              <Button
                variant="quiet"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
              >
                <X aria-hidden="true" size={19} />
              </Button>
            </div>
            <div onClick={() => setMobileOpen(false)}>
              <Navigation user={user} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-[var(--border)] bg-white/90 px-4 backdrop-blur-md md:px-6">
          <Button
            variant="quiet"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu aria-hidden="true" size={20} />
          </Button>
          <div className="ml-auto min-w-0 text-right">
            <p className="truncate text-xs font-bold text-[var(--text)]">
              {user.employment?.unit.name ?? "Administração da plataforma"}
            </p>
            <p className="hidden text-[10px] text-[var(--text-faint)] sm:block">
              Ambiente interno da CGE Amazonas
            </p>
          </div>
        </header>

        <main
          id="conteudo"
          className="mx-auto w-full max-w-[1440px] p-4 md:p-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
