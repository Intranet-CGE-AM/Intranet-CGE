import type {
  PublicVisitConfirmation,
} from "@cge/contracts";

import {
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  useSearchParams,
} from "react-router";

import {
  api,
  ApiError,
  json,
} from "../lib/api";

/* =========================================================
 * ESTADO LOCAL
 * ======================================================= */

type ResponseState =
  | "idle"
  | "sending"
  | "confirmed"
  | "declined";

/* =========================================================
 * PÁGINA
 * ======================================================= */

export function VisitConfirmationPage() {
  const [
    searchParams,
  ] =
    useSearchParams();

  const token =
    searchParams
      .get("token")
      ?.trim() ?? "";

  const [
    visit,
    setVisit,
  ] =
    useState<
      PublicVisitConfirmation
      | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    responseState,
    setResponseState,
  ] =
    useState<ResponseState>(
      "idle",
    );

  const [
    error,
    setError,
  ] =
    useState("");

  /* =======================================================
   * CARREGAR AGENDAMENTO
   * ===================================================== */

  const load =
    useCallback(
      async () => {
        if (!token) {
          setError(
            "Link de confirmação inválido.",
          );

          setLoading(
            false,
          );

          return;
        }

        try {
          setLoading(
            true,
          );

          setError("");

          const result =
            await api<
              PublicVisitConfirmation
            >(
              `/api/public/visit-confirmations/${encodeURIComponent(
                token,
              )}`,
            );

          setVisit(
            result,
          );

          if (
            result.status ===
            "confirmed"
          ) {
            setResponseState(
              "confirmed",
            );
          }

          if (
            result.status ===
            "declined"
          ) {
            setResponseState(
              "declined",
            );
          }
        } catch (cause) {
          setError(
            getErrorMessage(
              cause,

              "Não foi possível consultar o agendamento.",
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [token],
    );

  useEffect(() => {
    void load();
  }, [load]);

  /* =======================================================
   * RESPONDER
   * ===================================================== */

  async function respond(
    response:
      | "confirmed"
      | "declined",
  ) {
    if (!token) {
      return;
    }

    try {
      setResponseState(
        "sending",
      );

      setError("");

      await api(
        `/api/public/visit-confirmations/${encodeURIComponent(
          token,
        )}`,
        {
          method:
            "POST",

          body:
            json({
              response,
            }),
        },
      );

      setResponseState(
        response,
      );
    } catch (cause) {
      setResponseState(
        "idle",
      );

      setError(
        getErrorMessage(
          cause,

          "Não foi possível registrar sua resposta.",
        ),
      );
    }
  }

  /* =======================================================
   * LOADING
   * ===================================================== */

  if (loading) {
    return (
      <PublicLayout>
        <div className="py-12 text-center">
          <p className="text-sm text-slate-600">
            Consultando agendamento...
          </p>
        </div>
      </PublicLayout>
    );
  }

  /* =======================================================
   * ERRO SEM VISITA
   * ===================================================== */

  if (
    error &&
    !visit
  ) {
    return (
      <PublicLayout>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h1 className="font-bold text-red-800">
            Não foi possível abrir o convite
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {error}
          </p>
        </div>
      </PublicLayout>
    );
  }

  /* =======================================================
   * JÁ CONFIRMADO
   * ===================================================== */

  if (
    responseState ===
    "confirmed"
  ) {
    return (
      <PublicLayout>
        <div className="py-10 text-center">
          <CheckCircle
            size={72}
            weight="duotone"
            className="mx-auto text-[#08756f]"
          />

          <h1 className="mt-5 text-2xl font-extrabold text-slate-900">
            Presença confirmada
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            Sua confirmação foi registrada com sucesso.
            O agendamento já foi atualizado na Intranet CGE.
          </p>

          <div className="mt-6 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            VISITA CONFIRMADA
          </div>
        </div>
      </PublicLayout>
    );
  }

  /* =======================================================
   * RECUSADO
   * ===================================================== */

  if (
    responseState ===
    "declined"
  ) {
    return (
      <PublicLayout>
        <div className="py-10 text-center">
          <XCircle
            size={72}
            weight="duotone"
            className="mx-auto text-slate-500"
          />

          <h1 className="mt-5 text-2xl font-extrabold text-slate-900">
            Resposta registrada
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            A Controladoria-Geral do Estado do Amazonas
            foi informada de que você não poderá comparecer.
          </p>
        </div>
      </PublicLayout>
    );
  }

  if (!visit) {
    return null;
  }

  /* =======================================================
   * CONVITE
   * ===================================================== */

  return (
    <PublicLayout>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#08756f]">
        Agendamento de Visitas
      </p>

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        Confirmação de visita
      </h1>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        Prezado(a){" "}
        <strong>
          {visit.visitorName}
        </strong>
        , existe uma visita agendada em seu nome junto à CGE Amazonas.
      </p>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <Info
          label="Protocolo"
          value={
            visit.protocol
          }
        />

        <Info
          label="Motivo da visita"
          value={
            visit.subject
          }
        />

        <Info
          label="Órgão / instituição"
          value={
            visit.organization
          }
        />

        <Info
          label="Data"
          value={
            formatDate(
              visit.scheduledDate,
            )
          }
        />

        <Info
          label="Horário"
          value={
            `${visit.startTime} às ${visit.endTime}`
          }
        />

        <Info
          label="Local"
          value={
            visit.location
          }
        />
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={
            responseState ===
            "sending"
          }
          onClick={() =>
            void respond(
              "confirmed",
            )
          }
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#08756f] px-5 font-bold text-white transition hover:bg-[#06635e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle
            size={21}
          />

          {responseState ===
          "sending"
            ? "Registrando..."
            : "Confirmar presença"}
        </button>

        <button
          type="button"
          disabled={
            responseState ===
            "sending"
          }
          onClick={() =>
            void respond(
              "declined",
            )
          }
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle
            size={21}
          />

          Não poderei comparecer
        </button>
      </div>

      <p className="mt-7 text-xs leading-5 text-slate-500">
        Sua resposta será registrada diretamente no
        sistema de Agendamento de Visitas da CGE Amazonas.
      </p>
    </PublicLayout>
  );
}

/* =========================================================
 * LAYOUT
 * ======================================================= */

function PublicLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f5f8f7] px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <header className="mb-8 border-b border-slate-200 pb-5">
          <div className="text-lg font-extrabold text-[#075f5b]">
            CGE Amazonas
          </div>

          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Controladoria-Geral do Estado do Amazonas
          </p>
        </header>

        {children}
      </div>
    </main>
  );
}

/* =========================================================
 * INFO
 * ======================================================= */

function Info({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="border-b border-slate-200 px-5 py-4 last:border-b-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
 * FORMATAR DATA
 * ======================================================= */

function formatDate(
  value:
    string,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}

/* =========================================================
 * ERRO
 * ======================================================= */

function getErrorMessage(
  cause:
    unknown,

  fallback:
    string,
) {
  return cause instanceof
    ApiError
    ? cause.message
    : fallback;
}