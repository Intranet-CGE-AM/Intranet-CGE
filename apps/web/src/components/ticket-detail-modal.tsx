import { useState } from "react";
import type {
  AuthenticatedUser,
  TicketDetail,
  TicketStatus,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  FormField,
  Input,
  Textarea,
} from "@cge/ui";
import {
  ArrowRight,
  ChatCircleText,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Info,
  ListBullets,
  MonitorArrowUp,
  PaperPlaneTilt,
  Pause,
  Play,
  ShieldCheck,
  Star,
} from "@phosphor-icons/react";

import { api, json } from "../lib/api";
import { canAccess } from "../lib/permissions";

export interface TicketDetailModalProps {
  ticketId: string | null;
  currentUser: AuthenticatedUser;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_VARIANTS: Record<
  TicketStatus,
  {
    label: string;
    variant: "neutral" | "success" | "warning" | "danger" | "brand";
  }
> = {
  open: { label: "Aberto", variant: "brand" },
  viewed: { label: "Visualizado", variant: "brand" },
  en_route: { label: "A Caminho", variant: "warning" },
  in_service: { label: "Em Atendimento", variant: "warning" },
  paused: { label: "Pausado", variant: "neutral" },
  maintenance: { label: "Manutenção Externa", variant: "neutral" },
  completed: { label: "Concluído", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

const STEPPER_STAGES: Array<{ status: TicketStatus; label: string }> = [
  { status: "open", label: "Aberto" },
  { status: "viewed", label: "Visualizado" },
  { status: "en_route", label: "A Caminho" },
  { status: "in_service", label: "Em Atendimento" },
  { status: "completed", label: "Concluído" },
];

export function TicketDetailModal({
  ticketId,
  currentUser,
  onClose,
  onUpdated,
}: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "chat" | "history">(
    "details",
  );
  const [copiedToken, setCopiedToken] = useState(false);

  // Chat message
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [cause, setCause] = useState("");
  const [solution, setSolution] = useState("");
  const [completionNote, setCompletionNote] = useState("");

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<
    "approve" | "reject"
  >("approve");
  const [approvalNote, setApprovalNote] = useState("");

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");

  const loadTicket = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      setActionError(null);
      const data = await api<TicketDetail>(`/api/tickets/${id}`);
      setTicket(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os detalhes do chamado.",
      );
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    if (ticketId) {
      void loadTicket(ticketId);
    }
  });

  if (!ticketId) return null;

  const isStaff = canAccess(currentUser, {
    anyOf: ["tickets.attend", "tickets.manage"],
  });
  const canApprove = canAccess(currentUser, {
    anyOf: ["tickets.approve", "tickets.manage"],
  });
  const isRequester = ticket?.requesterAccountId === currentUser.account.id;

  const copyTrackNumber = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticketNumber);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const copyAnyDesk = () => {
    if (!ticket?.anyDeskCode) return;
    navigator.clipboard.writeText(ticket.anyDeskCode);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // ── Ações de Status ──────────────────────────────────────────────────────
  const handleTransition = async (toStatus: TicketStatus) => {
    if (!ticket) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const updated = await api<TicketDetail>(
        `/api/tickets/${ticket.id}/transition`,
        {
          method: "POST",
          body: json({ toStatus }),
        },
      );
      setTicket(updated);
      onUpdated();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar status do chamado.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!ticket || !pauseReason.trim()) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const updated = await api<TicketDetail>(
        `/api/tickets/${ticket.id}/pause`,
        {
          method: "POST",
          body: json({ reason: pauseReason.trim() }),
        },
      );
      setTicket(updated);
      setPauseModalOpen(false);
      setPauseReason("");
      onUpdated();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao pausar atendimento.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!ticket) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const updated = await api<TicketDetail>(
        `/api/tickets/${ticket.id}/resume`,
        {
          method: "POST",
        },
      );
      setTicket(updated);
      onUpdated();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao retomar atendimento.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!ticket) return;
    if (ticket.requiresCauseSolution && (!cause.trim() || !solution.trim())) {
      setActionError("Por favor, informe a causa e a solução aplicada.");
      return;
    }
    try {
      setActionLoading(true);
      setActionError(null);
      const updated = await api<TicketDetail>(
        `/api/tickets/${ticket.id}/transition`,
        {
          method: "POST",
          body: json({
            toStatus: "completed",
            cause: cause.trim() || undefined,
            solution: solution.trim() || undefined,
            completionNote: completionNote.trim() || undefined,
          }),
        },
      );
      setTicket(updated);
      setCompleteModalOpen(false);
      onUpdated();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao concluir chamado.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!ticket || !cancelReason.trim()) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const updated = await api<TicketDetail>(
        `/api/tickets/${ticket.id}/cancel`,
        {
          method: "POST",
          body: json({ reason: cancelReason.trim() }),
        },
      );
      setTicket(updated);
      setCancelModalOpen(false);
      setCancelReason("");
      onUpdated();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao cancelar chamado.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovalDecision = async () => {
    if (!ticket) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const updated = await api<TicketDetail>(
        `/api/tickets/${ticket.id}/approve`,
        {
          method: "POST",
          body: json({
            decision: approvalDecision,
            note: approvalNote.trim() || undefined,
          }),
        },
      );
      setTicket(updated);
      setApprovalModalOpen(false);
      setApprovalNote("");
      onUpdated();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Erro ao registrar decisão de aprovação.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !newMessage.trim()) return;
    try {
      setSendingMsg(true);
      setActionError(null);
      const msg = await api<{
        id: string;
        authorName: string;
        fromUser: boolean;
        content: string;
        createdAt: string;
      }>(`/api/tickets/${ticket.id}/messages`, {
        method: "POST",
        body: json({ content: newMessage.trim() }),
      });
      setTicket((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg as never] } : prev,
      );
      setNewMessage("");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar mensagem.",
      );
    } finally {
      setSendingMsg(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!ticket) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const fb = await api<{
        id: string;
        rating: number;
        comment?: string | null;
        createdAt: string;
      }>(`/api/tickets/${ticket.id}/feedback`, {
        method: "POST",
        body: json({
          rating: feedbackRating,
          comment: feedbackComment.trim() || undefined,
        }),
      });
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              hasFeedback: true,
              feedback: {
                ...fb,
                ticketId: prev.id,
                technicianAccountId: prev.assignedTechAccountId,
                technicianName: prev.technicianName,
              },
            }
          : prev,
      );
      setFeedbackModalOpen(false);
      onUpdated();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao enviar avaliação.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Cálculo de índice de progresso no Stepper
  const getStepperIndex = (status: TicketStatus) => {
    if (status === "cancelled") return -1;
    if (status === "open") return 0;
    if (status === "viewed") return 1;
    if (status === "en_route") return 2;
    if (
      status === "in_service" ||
      status === "paused" ||
      status === "maintenance"
    )
      return 3;
    if (status === "completed") return 4;
    return 0;
  };

  const currentStep = ticket ? getStepperIndex(ticket.status) : 0;

  return (
    <Dialog
      open={Boolean(ticketId)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        title={`Chamado #${ticket?.ticketNumber ?? ""}`}
        description="Acompanhamento e atendimento de suporte técnico"
        className="max-h-[92vh] max-w-4xl overflow-y-auto p-0 sm:max-w-4xl"
      >
        {loading ? (
          <div className="flex h-72 items-center justify-center space-x-3 text-[var(--text-muted)]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
            <span>Carregando dados do chamado...</span>
          </div>
        ) : error || !ticket ? (
          <div className="p-6">
            <Alert tone="danger" title="Erro ao carregar chamado">
              {error ?? "Chamado não encontrado."}
            </Alert>
          </div>
        ) : (
          <div className="flex flex-col">
            {actionError && (
              <div className="p-4">
                <Alert tone="danger" title="Atenção">
                  {actionError}
                </Alert>
              </div>
            )}
            {/* ── Top Header ─────────────────────────────────────────────── */}
            <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold tracking-tight text-[var(--text)]">
                      #{ticket.ticketNumber}
                    </span>
                    <button
                      type="button"
                      onClick={copyTrackNumber}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)]"
                      title="Copiar número do chamado"
                    >
                      {copiedToken ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedToken ? "Copiado!" : "Copiar"}
                    </button>
                    <Badge variant={STATUS_VARIANTS[ticket.status].variant}>
                      {STATUS_VARIANTS[ticket.status].label}
                    </Badge>
                    {ticket.approvalStatus === "pending" && (
                      <Badge variant="warning">Aguardando Chefia</Badge>
                    )}
                    {ticket.approvalStatus === "approved" && (
                      <Badge variant="success">Aprovado pela Chefia</Badge>
                    )}
                    {ticket.approvalStatus === "rejected" && (
                      <Badge variant="danger">Reprovado pela Chefia</Badge>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)]">
                    {ticket.categoryName}
                    {ticket.subcategoryName
                      ? ` › ${ticket.subcategoryName}`
                      : ""}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right text-xs text-[var(--text-muted)]">
                    <div>
                      Aberto em{" "}
                      {new Date(ticket.openedAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                    {ticket.slaDeadline && (
                      <div className="mt-0.5 flex items-center justify-end gap-1 font-medium text-amber-700 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        SLA:{" "}
                        {new Date(ticket.slaDeadline).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Stepper Visual ───────────────────────────────────────── */}
              {ticket.status !== "cancelled" ? (
                <div className="mt-6">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-[var(--border)]" />
                    <div
                      className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--action)] transition-all duration-500"
                      style={{
                        width: `${(Math.max(0, currentStep) / (STEPPER_STAGES.length - 1)) * 100}%`,
                      }}
                    />
                    {STEPPER_STAGES.map((step, idx) => {
                      const isPast = idx < currentStep;
                      const isCurrent = idx === currentStep;
                      return (
                        <div
                          key={step.status}
                          className="relative z-10 flex flex-col items-center"
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                              isPast
                                ? "border-[var(--action)] bg-[var(--action)] text-white"
                                : isCurrent
                                  ? "border-[var(--action)] bg-[var(--surface)] text-[var(--action)] shadow-md ring-4 ring-[var(--brand-soft)]"
                                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
                            }`}
                          >
                            {isPast ? (
                              <Check className="h-4 w-4 stroke-[3]" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <span
                            className={`mt-1.5 text-xs font-medium ${
                              isCurrent
                                ? "text-[var(--action)] font-semibold"
                                : isPast
                                  ? "text-[var(--text)]"
                                  : "text-[var(--text-muted)]"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
                  <strong>Chamado Cancelado:</strong>{" "}
                  {ticket.cancelNote || "Sem justificativa informada."}
                </div>
              )}
            </div>

            {/* ── Deliberação de Aprovação (Chefe de Setor) ──────────────── */}
            {canApprove &&
              ticket.approvalStatus === "pending" &&
              ticket.status !== "cancelled" && (
                <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3.5 dark:border-amber-900/60 dark:bg-amber-950/40">
                  <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
                    <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <span>
                      Este chamado requer aprovação da chefia do setor antes de
                      ser atendido pela ATEC.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setApprovalDecision("reject");
                        setApprovalModalOpen(true);
                      }}
                    >
                      Rejeitar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setApprovalDecision("approve");
                        setApprovalModalOpen(true);
                      }}
                    >
                      Aprovar Chamado
                    </Button>
                  </div>
                </div>
              )}

            {/* ── Barra de Ações do Técnico de TI ────────────────────────── */}
            {isStaff &&
              ticket.status !== "completed" &&
              ticket.status !== "cancelled" && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Ações Técnicas:
                    </span>
                    {ticket.status === "open" && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition("viewed")}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" /> Assumir /
                        Iniciar
                      </Button>
                    )}
                    {ticket.status === "viewed" && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleTransition("en_route")}
                        >
                          <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> A
                          Caminho
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleTransition("in_service")}
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" /> Iniciar
                          Atendimento
                        </Button>
                      </>
                    )}
                    {ticket.status === "en_route" && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition("in_service")}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" /> Iniciar
                        Atendimento
                      </Button>
                    )}
                    {ticket.status === "in_service" && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => setPauseModalOpen(true)}
                        >
                          <Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => setCompleteModalOpen(true)}
                        >
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />{" "}
                          Concluir Chamado
                        </Button>
                      </>
                    )}
                    {ticket.status === "paused" && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={handleResume}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" /> Retomar
                        Atendimento
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Cancelar Chamado
                  </Button>
                </div>
              )}

            {/* ── Tabs de Navegação Interna ──────────────────────────────── */}
            <div className="flex border-b border-[var(--border)] px-6">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  activeTab === "details"
                    ? "border-[var(--brand)] text-[var(--brand)] font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Info className="h-4 w-4" /> Detalhes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  activeTab === "chat"
                    ? "border-[var(--brand)] text-[var(--brand)] font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <ChatCircleText className="h-4 w-4" /> Mensagens / Chat
                {ticket.messages.length > 0 && (
                  <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs">
                    {ticket.messages.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  activeTab === "history"
                    ? "border-[var(--brand)] text-[var(--brand)] font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <ListBullets className="h-4 w-4" /> Histórico de Eventos
                <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs">
                  {ticket.events.length}
                </span>
              </button>
            </div>

            {/* ── Conteúdo das Tabs ───────────────────────────────────────── */}
            <div className="p-6">
              {activeTab === "details" && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {/* Coluna Principal: Detalhes do Chamado */}
                  <div className="space-y-6 md:col-span-2">
                    {/* AnyDesk Box se remoto */}
                    {ticket.anyDeskCode && (
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <MonitorArrowUp className="h-6 w-6 text-cyan-700 dark:text-cyan-400" />
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                                Código de Acesso Remoto (AnyDesk)
                              </div>
                              <div className="font-mono text-xl font-extrabold tracking-wide text-cyan-950 dark:text-cyan-100">
                                {ticket.anyDeskCode}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={copyAnyDesk}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
                            Código
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Descrição do Problema */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Descrição da Solicitação
                      </h3>
                      <div className="mt-2 whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text)] leading-relaxed">
                        {ticket.freeTextDescription ||
                          "Sem descrição adicional informada."}
                      </div>
                    </div>

                    {/* Conclusão Técnica (Causa e Solução) */}
                    {ticket.status === "completed" && (
                      <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle className="h-5 w-5" />
                          <h4 className="font-semibold">
                            Registro de Conclusão Técnica
                          </h4>
                        </div>
                        {ticket.cause && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">
                              Causa Identificada:
                            </div>
                            <p className="mt-1 text-sm text-[var(--text)]">
                              {ticket.cause}
                            </p>
                          </div>
                        )}
                        {ticket.solution && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">
                              Solução Aplicada:
                            </div>
                            <p className="mt-1 text-sm text-[var(--text)]">
                              {ticket.solution}
                            </p>
                          </div>
                        )}
                        {ticket.completionNote && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">
                              Observações:
                            </div>
                            <p className="mt-1 text-sm text-[var(--text)]">
                              {ticket.completionNote}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Avaliação do Solicitante */}
                    {ticket.status === "completed" && (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--text)]">
                              Avaliação do Atendimento
                            </h4>
                            {ticket.feedback ? (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex text-amber-500">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`h-5 w-5 ${
                                        star <= ticket.feedback!.rating
                                          ? "fill-amber-400 text-amber-500"
                                          : "text-gray-300 dark:text-gray-600"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm font-medium text-[var(--text)]">
                                  {ticket.feedback.rating}/5
                                </span>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-[var(--text-muted)]">
                                O solicitante ainda não avaliou este
                                atendimento.
                              </p>
                            )}
                            {ticket.feedback?.comment && (
                              <p className="mt-2 italic text-sm text-[var(--text-muted)]">
                                "{ticket.feedback.comment}"
                              </p>
                            )}
                          </div>
                          {isRequester && !ticket.hasFeedback && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setFeedbackModalOpen(true)}
                            >
                              <Star className="mr-1.5 h-4 w-4" /> Avaliar
                              Atendimento
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coluna Lateral: Metadados */}
                  <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Solicitante
                      </span>
                      <div className="mt-1 text-sm font-medium text-[var(--text)]">
                        {ticket.requesterName}
                      </div>
                      {ticket.requesterEmail && (
                        <div className="text-xs text-[var(--text-muted)]">
                          {ticket.requesterEmail}
                        </div>
                      )}
                      {ticket.unitName && (
                        <div className="mt-1 inline-block rounded bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                          {ticket.unitName}
                        </div>
                      )}
                    </div>

                    {ticket.beneficiaryName && (
                      <div className="border-t border-[var(--border)] pt-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Beneficiário do Chamado
                        </span>
                        <div className="mt-1 text-sm font-medium text-[var(--text)]">
                          {ticket.beneficiaryName}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-[var(--border)] pt-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Técnico Responsável
                      </span>
                      <div className="mt-1 text-sm font-medium text-[var(--text)]">
                        {ticket.technicianName || "Não atribuído"}
                      </div>
                      {ticket.areaResponsavel && (
                        <div className="mt-0.5 text-xs capitalize text-[var(--text-muted)]">
                          Área: {ticket.areaResponsavel}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[var(--border)] pt-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Modalidade
                      </span>
                      <div className="mt-1 text-sm text-[var(--text)]">
                        {ticket.isRemote
                          ? "Suporte Remoto"
                          : "Presencial (Na CGE)"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "chat" && (
                <div className="flex flex-col space-y-4">
                  <div className="max-h-96 min-h-[220px] space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                    {ticket.messages.length === 0 ? (
                      <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
                        Nenhuma mensagem enviada. Use o campo abaixo para
                        conversar com a equipe.
                      </div>
                    ) : (
                      ticket.messages.map((m) => {
                        const isMe =
                          m.authorAccountId === currentUser.account.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${
                              isMe ? "items-end" : "items-start"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                              <span>{m.authorName}</span>
                              <span>•</span>
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString(
                                  "pt-BR",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>
                            <div
                              className={`mt-1 max-w-md rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${
                                isMe
                                  ? "bg-[var(--action)] text-white"
                                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                              }`}
                            >
                              {m.content}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2"
                  >
                    <Input
                      placeholder="Escreva uma mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sendingMsg}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={sendingMsg || !newMessage.trim()}
                    >
                      <PaperPlaneTilt className="mr-1.5 h-4 w-4" /> Enviar
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-4">
                  {ticket.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 border-l-2 border-[var(--brand)] pl-4 py-1"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text)]">
                            {ev.actorName || "Sistema"}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {new Date(ev.createdAt).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                          {ev.note || `Alteração de status para ${ev.toStatus}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* ── Modal de Pausa ─────────────────────────────────────────────────── */}
      <Dialog open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
        <DialogContent
          title="Pausar Atendimento"
          description="Informe a justificativa da pausa. O contador de SLA será suspenso durante a pausa."
          className="max-w-md"
        >
          <div className="mt-2">
            <FormField htmlFor="pause-reason" label="Motivo da Pausa">
              <Textarea
                id="pause-reason"
                rows={3}
                placeholder="Ex: Aguardando peça de reposição / usuário ausente..."
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setPauseModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!pauseReason.trim() || actionLoading}
              onClick={handlePause}
            >
              Confirmar Pausa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Conclusão ─────────────────────────────────────────────── */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent
          title="Concluir Atendimento"
          description="Preencha os dados técnicos do fechamento para compor o histórico e a base de conhecimento."
          className="max-w-lg"
        >
          <div className="mt-2 space-y-4">
            <FormField htmlFor="complete-cause" label="Causa do Problema">
              <Input
                id="complete-cause"
                placeholder="Ex: Cabo de rede rompido / Usuário bloqueado no AD..."
                value={cause}
                onChange={(e) => setCause(e.target.value)}
              />
            </FormField>
            <FormField htmlFor="complete-solution" label="Solução Aplicada">
              <Input
                id="complete-solution"
                placeholder="Ex: Substituição de conector RJ-45 / Reset e desbloqueio de senha..."
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="complete-note"
              label="Observações de Encerramento"
            >
              <Textarea
                id="complete-note"
                rows={2}
                placeholder="Orientações dadas ao usuário ou notas adicionais..."
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setCompleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={
                actionLoading ||
                (ticket?.requiresCauseSolution &&
                  (!cause.trim() || !solution.trim()))
              }
              onClick={handleComplete}
            >
              Finalizar Chamado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Cancelamento ─────────────────────────────────────────── */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent
          title="Cancelar Chamado"
          description="Por favor, informe a justificativa para o cancelamento deste chamado."
          className="max-w-md"
        >
          <div className="mt-2">
            <FormField
              htmlFor="cancel-reason"
              label="Justificativa do Cancelamento"
            >
              <Textarea
                id="cancel-reason"
                rows={3}
                placeholder="Ex: Solicitação aberta em duplicidade / Problema sanado pelo usuário..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setCancelModalOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim() || actionLoading}
              onClick={handleCancel}
            >
              Confirmar Cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Deliberação de Chefia ────────────────────────────────── */}
      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
        <DialogContent
          title={
            approvalDecision === "approve"
              ? "Aprovar Solicitação de TI"
              : "Rejeitar Solicitação de TI"
          }
          description={
            approvalDecision === "approve"
              ? "Ao aprovar, o chamado será liberado para atendimento pela equipe técnica da ATEC."
              : "Ao rejeitar, o chamado será cancelado automaticamente."
          }
          className="max-w-md"
        >
          <div className="mt-2">
            <FormField
              htmlFor="approval-note"
              label={
                approvalDecision === "approve"
                  ? "Observações (Opcional)"
                  : "Justificativa da Rejeição"
              }
            >
              <Textarea
                id="approval-note"
                rows={3}
                placeholder={
                  approvalDecision === "approve"
                    ? "Observações para a equipe de TI..."
                    : "Motivo da recusa da solicitação..."
                }
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setApprovalModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={approvalDecision === "approve" ? "primary" : "danger"}
              disabled={
                actionLoading ||
                (approvalDecision === "reject" && !approvalNote.trim())
              }
              onClick={handleApprovalDecision}
            >
              {approvalDecision === "approve"
                ? "Confirmar Aprovação"
                : "Confirmar Rejeição"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Avaliação ────────────────────────────────────────────── */}
      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent
          title="Avaliar Atendimento"
          description="Sua opinião nos ajuda a aprimorar o suporte de TI da Controladoria Geral do Estado."
          className="max-w-md"
        >
          <div className="my-6 flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFeedbackRating(star)}
                className="transition hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= feedbackRating
                      ? "fill-amber-400 text-amber-500"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                />
              </button>
            ))}
          </div>
          <FormField
            htmlFor="feedback-comment"
            label="Comentário adicional (Opcional)"
          >
            <Textarea
              id="feedback-comment"
              rows={3}
              placeholder="Conte como foi o atendimento..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
          </FormField>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setFeedbackModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={actionLoading}
              onClick={handleFeedbackSubmit}
            >
              Enviar Avaliação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
