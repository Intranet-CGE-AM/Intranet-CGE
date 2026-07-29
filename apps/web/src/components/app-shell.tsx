import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@cge/ui";
import {
  CaretLeft,
  CaretRight,
  CaretUpDown,
  Key,
  List,
  ShieldCheck,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { useAuth } from "../auth";
import {
  availableModules,
  availableSystemNavigation,
  canNavigate,
  homeNavigation,
  type NavigationItem,
} from "../navigation";

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <ShieldCheck
        aria-hidden="true"
        className="shrink-0 text-[var(--brand)]"
        size={30}
        weight="fill"
      />
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
  onNavigate,
  user,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const { pathname } = useLocation();
  const modules = availableModules(user);
  const systemItems = availableSystemNavigation(user);

  return (
    <nav aria-label="Navegação principal" className="mt-8 space-y-1">
      {!collapsed ? (
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Intranet
        </p>
      ) : null}
      <NavigationLink
        collapsed={collapsed}
        item={homeNavigation}
        onNavigate={onNavigate}
      />

      {modules.length ? (
        <div className={collapsed ? "pt-3" : "pt-5"}>
          {!collapsed ? (
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
              Módulos
            </p>
          ) : null}
          <div className="space-y-1">
            {modules.map((module) => {
              const Icon = module.icon;
              const active =
                pathname === module.href ||
                pathname.startsWith(`${module.href}/`);
              return (
                <div key={module.id}>
                  <Link
                    aria-label={collapsed ? module.label : undefined}
                    className={[
                      "flex min-h-10 items-center rounded-[10px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]",
                      collapsed ? "justify-center px-2" : "gap-3 px-3",
                      active
                        ? "text-[var(--brand-strong)]"
                        : "text-[var(--text-muted)] hover:bg-white hover:text-[var(--text)]",
                    ].join(" ")}
                    onClick={onNavigate}
                    title={collapsed ? module.label : undefined}
                    to={module.href}
                  >
                    <Icon aria-hidden="true" size={18} />
                    {!collapsed ? <span>{module.label}</span> : null}
                  </Link>
                  {active && !collapsed ? (
                    <div className="ml-[21px] mt-1 space-y-1 border-l border-[var(--border)] pl-3">
                      {module.routes
                        .filter((route) => canNavigate(user, route))
                        .map((route) => (
                          <NavigationLink
                            item={route}
                            key={route.href}
                            nested
                            onNavigate={onNavigate}
                          />
                        ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {systemItems.length ? (
        <div className={collapsed ? "pt-3" : "pt-5"}>
          {!collapsed ? (
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
              Sistema
            </p>
          ) : null}
          {systemItems.map((item) => (
            <NavigationLink
              collapsed={collapsed}
              item={item}
              key={item.href}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function NavigationLink({
  collapsed = false,
  item,
  nested = false,
  onNavigate,
}: {
  collapsed?: boolean;
  item: NavigationItem;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [
          "flex items-center rounded-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]",
          nested
            ? "min-h-9 gap-2.5 px-3 text-xs"
            : collapsed
              ? "min-h-10 justify-center px-2 text-sm"
              : "min-h-10 gap-3 px-3 text-sm",
          isActive
            ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
            : "text-[var(--text-muted)] hover:bg-white hover:text-[var(--text)]",
        ].join(" ")
      }
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      to={item.href}
    >
      <Icon aria-hidden="true" size={nested ? 16 : 18} />
      {!collapsed ? <span>{item.label}</span> : null}
    </NavLink>
  );
}

function AccountMenu({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { logout, user } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Abrir menu da conta de ${user.person.displayName}`}
          className={[
            "flex w-full items-center rounded-[10px] border border-[var(--border)] bg-white/60 p-2 text-left transition-[background-color,border-color] hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] data-[state=open]:border-[var(--brand)] data-[state=open]:bg-white",
            collapsed ? "justify-center" : "gap-3",
          ].join(" ")}
          type="button"
        >
          <Avatar
            className="bg-white"
            name={user.person.displayName}
            src={user.person.avatarUrl}
          />
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
              <CaretUpDown
                aria-hidden="true"
                className="text-[var(--text-faint)]"
                size={15}
              />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed ? "end" : "start"}
        side={collapsed ? "right" : "top"}
      >
        <DropdownMenuLabel>
          <span className="block truncate text-xs font-bold">
            {user.person.displayName}
          </span>
          <span className="mt-0.5 block truncate text-[10px] font-medium text-[var(--text-faint)]">
            {user.account.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link onClick={onNavigate} to="/conta">
            <UserCircle aria-hidden="true" size={18} />
            Minha conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link onClick={onNavigate} to="/conta#seguranca">
            <Key aria-hidden="true" size={18} />
            Alterar senha
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[var(--danger)] data-[highlighted]:bg-[var(--danger-soft)] data-[highlighted]:text-[var(--danger-strong)]"
          onSelect={() => void logout()}
        >
          <SignOut aria-hidden="true" size={18} />
          Sair da intranet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) {
    return null;
  }
  const activeModule = availableModules(user).find(
    (module) =>
      pathname === module.href || pathname.startsWith(`${module.href}/`),
  );
  const inSystem = pathname.startsWith("/sistema/");
  const contextTitle = activeModule
    ? activeModule.label
    : inSystem
      ? "Administração da plataforma"
      : "Intranet CGE";
  const contextDescription = activeModule
    ? "Módulo da Intranet CGE"
    : inSystem
      ? "Configurações compartilhadas"
      : "Página inicial da intranet";

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="min-h-[100dvh] lg:grid lg:grid-cols-[auto_1fr]">
        <a
          href="#conteudo"
          className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
        >
          Ir para o conteúdo
        </a>

        <aside
          className={[
            "sticky top-0 z-50 hidden h-[100dvh] border-r border-[var(--border)] bg-[#f7f8f8] p-3 transition-[width] duration-200 lg:flex lg:flex-col",
            collapsed ? "w-[76px]" : "w-[248px]",
          ].join(" ")}
        >
          <button
            aria-label={
              collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            className="absolute -right-3.5 top-6 z-10 grid size-7 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--text-muted)] shadow-[0_1px_3px_rgb(16_35_38/10%)] transition-[background-color,color,transform] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] active:scale-95"
            onClick={() => setCollapsed((value) => !value)}
            title={
              collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            type="button"
          >
            {collapsed ? (
              <CaretRight aria-hidden="true" size={14} weight="bold" />
            ) : (
              <CaretLeft aria-hidden="true" size={14} weight="bold" />
            )}
          </button>
          <div className={collapsed ? "px-1 pt-1" : "px-2 pt-1"}>
            <Logo collapsed={collapsed} />
            <Navigation collapsed={collapsed} user={user} />
          </div>
          <div className="mt-auto">
            <AccountMenu collapsed={collapsed} />
          </div>
        </aside>

        <SheetContent
          className="flex flex-col bg-[#f7f8f8] lg:hidden"
          title="Navegação principal"
          description="Acesse os módulos permitidos para sua conta."
        >
          <Logo />
          <Navigation user={user} onNavigate={() => setMobileOpen(false)} />
          <div className="mt-auto pt-6">
            <AccountMenu onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-[var(--border)] bg-white/90 px-4 backdrop-blur-md md:px-6">
            <SheetTrigger asChild>
              <Button
                variant="quiet"
                size="icon"
                className="lg:hidden"
                aria-label="Abrir menu"
              >
                <List aria-hidden="true" size={20} />
              </Button>
            </SheetTrigger>
            <p className="hidden text-xs font-bold text-[var(--text-muted)] sm:block lg:hidden">
              Intranet CGE
            </p>
            <div className="ml-auto min-w-0 text-right">
              <p className="truncate text-xs font-bold text-[var(--text)]">
                {contextTitle}
              </p>
              <p className="hidden text-[10px] text-[var(--text-faint)] sm:block">
                {contextDescription}
              </p>
            </div>
          </header>

          <main
            id="conteudo"
            className="mx-auto w-full max-w-[1440px] overflow-x-clip p-4 md:p-6"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </Sheet>
  );
}
