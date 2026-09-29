import type { PublicVisitConfirmation } from "@cge/contracts";

import { Alert, Badge, Button, Card, Skeleton } from "@cge/ui";

import { CheckCircle, ShieldCheck, XCircle } from "@phosphor-icons/react";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useParams, useSearchParams } from "react-router";

import { VisitDetail } from "../components/visit-ui";
import { api, json } from "../lib/api";
import {
  formatVisitDate,
  formatVisitTime,
  visitErrorMessage,
} from "../lib/visit-labels";

/* =========================================================
 * ESTADO LOCAL
 * ======================================================= */

type ResponseState = "idle" | "sending" | "confirmed" | "declined";

/* =========================================================
 * PÁGINA
 * ======================================================= */

export function VisitConfirmationPage() {
  const [searchParams] = useSearchParams();

  const params = useParams();

  // The email links to /visitas/confirmar/:token; ?token= kept for old links.
  const token = (params.token ?? searchParams.get("token") ?? "").trim();

  const [visit, setVisit] = useState<PublicVisitConfirmation | null>(null);

  const [loading, setLoading] = useState(true);

  const [responseState, setResponseState] = useState<ResponseState>("idle");

  const [error, setError] = useState("");

  /* =======================================================
   * CARREGAR AGENDAMENTO
   * ===================================================== */

  const load = useCallback(async () => {
    if (!token) {
      setError("Link de confirmação inválido.");

      setLoading(false);

      return;
    }

    try {
      setLoading(true);

      setError("");

      const result = await api<PublicVisitConfirmation>(
        `/api/public/visit-confirmations/${encodeURIComponent(token)}`,
      );

      setVisit(result);

      if (result.status === "confirmed") {
        setResponseState("confirmed");
      }

      if (result.status === "declined") {
        setResponseState("declined");
      }
    } catch (cause) {
      setError(
        visitErrorMessage(
          cause,

          "Não foi possível consultar o agendamento.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  /* =======================================================
   * RESPONDER
   * ===================================================== */

  async function respond(response: "confirmed" | "declined") {
    if (!token) {
      return;
    }

    try {
      setResponseState("sending");

      setError("");

      await api(
        `/api/public/visit-confirmations/${encodeURIComponent(token)}`,
        {
          method: "POST",

          body: json({
            response,
          }),
        },
      );

      setResponseState(response);
    } catch (cause) {
      setResponseState("idle");

      setError(
        visitErrorMessage(
          cause,

          "Não foi possível registrar sua resposta.",
        ),
      );
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div role="status">
          <p className="text-sm text-[var(--text-muted)]">
            Consultando agendamento…
          </p>

          <Skeleton className="mt-4 h-9 w-64" />

          <Skeleton className="mt-3 h-4 w-full" />

          <Skeleton className="mt-8 h-56 w-full" />
        </div>
      </PublicLayout>
    );
  }

  if (!visit) {
    return (
      <PublicLayout>
        <PageTitle>Convite indisponível</PageTitle>

        <Alert
          className="mt-6"
          title="Não foi possível abrir o convite"
          tone="danger"
        >
          {error || "Link de confirmação inválido."} Se precisar, entre em
          contato com a CGE Amazonas para receber um novo convite.
        </Alert>
      </PublicLayout>
    );
  }

  if (responseState === "confirmed") {
    return (
      <PublicLayout>
        <CheckCircle
          aria-hidden="true"
          className="text-[var(--success)]"
          size={56}
          weight="duotone"
        />

        <PageTitle>Presença confirmada</PageTitle>

        <Badge className="mt-4" variant="success">
          Visita confirmada
        </Badge>

        <Alert className="mt-6" title="Resposta registrada" tone="success">
          Sua confirmação foi registrada. O agendamento já foi atualizado na
          Intranet CGE.
        </Alert>
      </PublicLayout>
    );
  }

  if (responseState === "declined") {
    return (
      <PublicLayout>
        <XCircle
          aria-hidden="true"
          className="text-[var(--text-faint)]"
          size={56}
          weight="duotone"
        />

        <PageTitle>Resposta registrada</PageTitle>

        <Alert className="mt-6" title="Ausência informada" tone="neutral">
          A Controladoria-Geral do Estado do Amazonas foi informada de que você
          não poderá comparecer.
        </Alert>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand)]">
        Agendamento de Visitas
      </p>

      <PageTitle>Confirmação de visita</PageTitle>

      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        Prezado(a){" "}
        <strong className="text-[var(--text)]">{visit.visitorName}</strong>,
        existe uma visita agendada em seu nome junto à CGE Amazonas.
      </p>

      {error ? (
        <Alert
          className="mt-6"
          title="Não foi possível registrar sua resposta"
          tone="danger"
        >
          {error}
        </Alert>
      ) : null}

      <Card className="mt-8 bg-[var(--surface-subtle)]">
        <dl className="grid gap-4 p-5 sm:grid-cols-2">
          <VisitDetail label="Protocolo">{visit.protocol}</VisitDetail>

          <VisitDetail label="Data">
            {formatVisitDate(visit.scheduledDate)}
          </VisitDetail>

          <VisitDetail className="sm:col-span-2" label="Motivo da visita">
            {visit.subject}
          </VisitDetail>

          <VisitDetail label="Órgão / instituição">
            {visit.organization}
          </VisitDetail>

          <VisitDetail label="Horário">
            {formatVisitTime(visit.startTime, visit.endTime)}
          </VisitDetail>

          <VisitDetail label="Local">{visit.location}</VisitDetail>
        </dl>
      </Card>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          disabled={responseState === "sending"}
          onClick={() => void respond("confirmed")}
        >
          <CheckCircle aria-hidden="true" size={16} />

          {responseState === "sending" ? "Registrando…" : "Confirmar presença"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={responseState === "sending"}
          onClick={() => void respond("declined")}
        >
          <XCircle aria-hidden="true" size={16} />
          Não poderei comparecer
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-[var(--text-faint)]">
        Sua resposta será registrada diretamente no sistema de Agendamento de
        Visitas da CGE Amazonas.
      </p>
    </PublicLayout>
  );
}

function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
      {children}
    </h1>
  );
}

// Mirrors the left column of components/auth-layout.tsx: this page is public.
function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-white px-5 py-6 sm:px-10">
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
            Controladoria-Geral do Estado
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[520px] flex-1 items-center py-12">
        <div className="w-full">{children}</div>
      </div>

      <p className="mx-auto max-w-lg text-center text-xs leading-5 text-[var(--text-faint)]">
        Controladoria-Geral do Estado do Amazonas. Este link é pessoal e vale
        somente para o convite recebido por e-mail.
      </p>
    </main>
  );
}
