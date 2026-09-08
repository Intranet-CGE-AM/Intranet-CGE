import type { NotificationPage } from "@cge/contracts";
import { Alert, Button } from "@cge/ui";
import { Bell } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { api } from "../lib/api";

export function NotificationBell() {
  const { pathname } = useLocation();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (!document.hidden)
        void api<NotificationPage>("/api/notifications", {
          signal: controller.signal,
        })
          .then((result) => setCount(result.unreadCount))
          .catch(() => {
            if (!controller.signal.aborted) setCount(null);
          });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("notifications-changed", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("notifications-changed", refresh);
    };
  }, [pathname]);
  return (
    <Link
      to="/notificacoes"
      aria-label={
        count === null
          ? "Notificações — contagem indisponível"
          : `Notificações, ${count} não lidas`
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
    >
      <Bell size={20} aria-hidden="true" />
      {count ? <span>{count}</span> : null}
    </Link>
  );
}

export function NotificationsPage() {
  const [data, setData] = useState<NotificationPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const load = useCallback(async (nextPage: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await api<NotificationPage>(
        `/api/notifications?page=${nextPage}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        setData(result);
        setPage(nextPage);
      }
    } catch {
      if (!controller.signal.aborted)
        setError("Não foi possível carregar as notificações. Tente novamente.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(1);
    return () => controllerRef.current?.abort();
  }, [load]);
  async function read(id?: string) {
    setBusy(true);
    setError("");
    try {
      await api(
        id ? `/api/notifications/${id}/read` : "/api/notifications/read-all",
        { method: "POST" },
      );
      await load(page);
      window.dispatchEvent(new Event("notifications-changed"));
    } catch {
      setError("Não foi possível marcar como lida. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Notificações</h1>
        <Button
          variant="secondary"
          disabled={busy || loading || !data?.unreadCount}
          onClick={() => void read()}
        >
          Marcar todas como lidas
        </Button>
      </header>
      {error ? (
        <Alert title="Não foi possível concluir" tone="danger">
          {error}
          <Button
            variant="quiet"
            disabled={busy || loading}
            onClick={() => {
              setError("");
              void load(page);
            }}
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : null}
      {loading && <p role="status">Carregando notificações…</p>}
      {!data ? null : !data.notifications.length ? (
        <p>Nenhuma notificação por enquanto.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {data.notifications.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-5"
            >
              <div className="min-w-0 space-y-2">
                <Link
                  className="font-semibold underline underline-offset-4"
                  to={item.href}
                >
                  {item.title}
                </Link>
                <p className="max-w-[70ch] break-words text-sm text-[var(--text-muted)]">
                  {item.message}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {new Date(item.createdAt).toLocaleString("pt-BR", {
                    timeZone: "America/Manaus",
                  })}{" "}
                  · {item.readAt ? "Lida" : "Não lida"}
                </p>
              </div>
              {!item.readAt ? (
                <Button
                  variant="quiet"
                  disabled={busy || loading}
                  onClick={() => void read(item.id)}
                >
                  Marcar como lida
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {page > 1 || data?.hasMore ? (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={busy || loading || page === 1}
            onClick={() => void load(page - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            variant="secondary"
            disabled={busy || loading || !data?.hasMore}
            onClick={() => void load(page + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
