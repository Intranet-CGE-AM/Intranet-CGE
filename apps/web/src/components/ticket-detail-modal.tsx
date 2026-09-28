import { useState, useEffect, useRef } from "react";
import {
  technicalAreaLabels,
  type AuthenticatedUser,
  type TicketDetail,
  type TicketMessage,
  type TicketStatus,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  Input,
  Skeleton,
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
  PaperPlaneTilt,
  Pause,
  Play,
  Star,
} from "@phosphor-icons/react";

import { api, json } from "../lib/api";
import { canAccess } from "../lib/permissions";
import { ticketStatus } from "../modules/tickets/ticket-status";

export interface TicketDetailModalProps {
  ticketId: string | null;
  currentUser: AuthenticatedUser;
  onClose: () => void;
  onUpdated: () => void;
}

const STEPPER_STAGES: Array<{ status: TicketStatus; label: string }> = [
  { status: "open", label: "Aberto" },
  { status: "viewed", label: "Visualizado" },
  { status: "en_route", label: "A caminho" },
  { status: "in_service", label: "Em atendimento" },
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
  const [copied, setCopied] = useState<"number" | "anydesk" | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

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

  const loadTicket = async (id: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      setActionError(null);
      const data = await api<TicketDetail>(`/api/tickets/${id}`);
      setTicket(data);
    } catch (err: unknown) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os detalhes do chamado.",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      void loadTicket(ticketId);
    }
  }, [ticketId]);

  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTab, ticket?.messages]);

  if (!ticketId) return null;

  const isStaff = canAccess(currentUser, {
    anyOf: ["tickets.attend", "tickets.manage"],
  });
  const canApprove = canAccess(currentUser, {
    anyOf: ["tickets.approve", "tickets.manage"],
  });
  const isRequester = ticket?.requesterAccountId === currentUser.account.id;

  const copyToClipboard = (text: string, key: "number" | "anydesk") => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
        setActionError("Não foi possível copiar. Selecione o texto e copie.");
      });
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
      setActionError("Informe a causa e a solução aplicada.");
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
    const content = newMessage.trim();
    if (!ticket || !content || sendingMsg) return;
    try {
      setSendingMsg(true);
      setActionError(null);
      setNewMessage("");
      const msg = await api<TicketMessage>(
        `/api/tickets/${ticket.id}/messages`,
        {
          method: "POST",
          body: json({ content }),
        },
      );
      setTicket((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    } catch (err: unknown) {
      setNewMessage(content);
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

  const ticketNumber = ticket?.ticketNumber.replace(/^#+/, "") ?? "";
  const status = ticket ? ticketStatus(ticket.status) : null;
  const actionAlert = actionError ? (
    <Alert tone="danger" title="Não foi possível concluir a ação">
      {actionError}
    </Alert>
  ) : null;

  const tabs = [
    { key: "details" as const, label: "Detalhes", icon: Info },
    {
      key: "chat" as const,
      label: `Mensagens${ticket?.messages.length ? ` (${ticket.messages.length})` : ""}`,
      icon: ChatCircleText,
    },
    {
      key: "history" as const,
      label: `Histórico (${ticket?.events.length ?? 0})`,
      icon: ListBullets,
    },
  ];

  const completionItems = ticket
    ? [
        { label: "Causa identificada", value: ticket.cause },
        { label: "Solução aplicada", value: ticket.solution },
        { label: "Observações", value: ticket.completionNote },
      ].filter((item) => Boolean(item.value))
    : [];

  return (
    <Dialog
      open={Boolean(ticketId)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        title={ticket ? `Chamado #${ticketNumber}` : "Chamado"}
        description={
          ticket
            ? `${ticket.categoryName}${ticket.subcategoryName ? ` › ${ticket.subcategoryName}` : ""}`
            : "Acompanhamento e atendimento de suporte técnico"
        }
        className="max-w-4xl"
      >
        {loading ? (
          <div
            aria-label="Carregando chamado"
            role="status"
            className="space-y-3"
          >
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-16" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32" />
          </div>
        ) : error || !ticket || !status ? (
          <Alert tone="danger" title="Não foi possível carregar o chamado">
            {error ?? "Chamado não encontrado."}
          </Alert>
        ) : (
          <div className="space-y-5">
            {actionAlert}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status.variant}>{status.label}</Badge>
                {ticket.approvalStatus === "pending" && (
                  <Badge variant="warning">Aguardando chefia</Badge>
                )}
                {ticket.approvalStatus === "approved" && (
                  <Badge variant="success">Aprovado pela chefia</Badge>
                )}
                {ticket.approvalStatus === "rejected" && (
                  <Badge variant="danger">Reprovado pela chefia</Badge>
                )}
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label="Copiar número do chamado"
                  onClick={() => copyToClipboard(ticketNumber, "number")}
                >
                  {copied === "number" ? (
                    <Check
                      aria-hidden="true"
                      className="text-[var(--success)]"
                      size={16}
                    />
                  ) : (
                    <Copy aria-hidden="true" size={16} />
                  )}
                  <span aria-live="polite">
                    {copied === "number" ? "Copiado" : "Copiar"}
                  </span>
                </Button>
              </div>
              <div className="text-xs text-[var(--text-muted)] sm:text-right">
                <p>
                  Aberto em{" "}
                  {new Date(ticket.openedAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                {ticket.slaDeadline && (
                  <p className="mt-0.5 flex items-center gap-1 font-medium text-[var(--warning-strong)] sm:justify-end">
                    <Clock aria-hidden="true" size={14} />
                    SLA:{" "}
                    {new Date(ticket.slaDeadline).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
            </div>

            {ticket.status !== "cancelled" ? (
              <div>
                <ol
                  aria-label="Progresso do chamado"
                  className="relative flex items-start justify-between"
                >
                  <li
                    aria-hidden="true"
                    className="absolute left-4 right-4 top-4 h-0.5 bg-[var(--border)]"
                  >
                    <span
                      className="block h-full bg-[var(--action)] transition-all duration-500"
                      style={{
                        width: `${(Math.max(0, currentStep) / (STEPPER_STAGES.length - 1)) * 100}%`,
                      }}
                    />
                  </li>
                  {STEPPER_STAGES.map((step, idx) => {
                    const isPast = idx < currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <li
                        key={step.status}
                        aria-current={isCurrent ? "step" : undefined}
                        className="relative z-10 flex flex-col items-center"
                      >
                        <span
                          className={`flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                            isPast
                              ? "border-[var(--action)] bg-[var(--action)] text-[var(--action-foreground)]"
                              : isCurrent
                                ? "border-[var(--action)] bg-[var(--surface)] text-[var(--action)]"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
                          }`}
                        >
                          {isPast ? (
                            <Check aria-hidden="true" size={16} weight="bold" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <span
                          className={`sr-only mt-1.5 text-xs sm:not-sr-only ${
                            isCurrent
                              ? "font-bold text-[var(--action)]"
                              : isPast
                                ? "font-medium text-[var(--text)]"
                                : "font-medium text-[var(--text-muted)]"
                          }`}
                        >
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {currentStep >= 0 && (
                  <p className="mt-2 text-xs font-bold text-[var(--action)] sm:hidden">
                    Etapa atual: {STEPPER_STAGES[currentStep]?.label}
                  </p>
                )}
              </div>
            ) : (
              <Alert tone="danger" title="Chamado cancelado">
                {ticket.cancelNote || "Sem justificativa informada."}
              </Alert>
            )}

            {canApprove &&
              ticket.approvalStatus === "pending" &&
              ticket.status !== "cancelled" && (
                <Alert tone="warning" title="Aprovação da chefia pendente">
                  <p>
                    Este chamado requer aprovação da chefia do setor antes de
                    ser atendido pela ATEC.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => {
                        setApprovalDecision("approve");
                        setApprovalModalOpen(true);
                      }}
                    >
                      Aprovar chamado
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => {
                        setApprovalDecision("reject");
                        setApprovalModalOpen(true);
                      }}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </Alert>
              )}

            {isStaff &&
              ticket.status !== "completed" &&
              ticket.status !== "cancelled" && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                      Ações técnicas
                    </span>
                    {ticket.status === "open" && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition("viewed")}
                      >
                        <Play aria-hidden="true" size={16} />
                        Assumir chamado
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
                          <ArrowRight aria-hidden="true" size={16} />A caminho
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleTransition("in_service")}
                        >
                          <Play aria-hidden="true" size={16} />
                          Iniciar atendimento
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
                        <Play aria-hidden="true" size={16} />
                        Iniciar atendimento
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
                          <Pause aria-hidden="true" size={16} />
                          Pausar
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => setCompleteModalOpen(true)}
                        >
                          <CheckCircle aria-hidden="true" size={16} />
                          Concluir chamado
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
                        <Play aria-hidden="true" size={16} />
                        Retomar atendimento
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Cancelar chamado
                  </Button>
                </div>
              )}

            <nav
              aria-label="Seções do chamado"
              className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
            >
              {tabs.map(({ key, label, icon: TabIcon }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={activeTab === key ? "primary" : "secondary"}
                  aria-pressed={activeTab === key}
                  onClick={() => setActiveTab(key)}
                >
                  <TabIcon aria-hidden="true" size={16} />
                  {label}
                </Button>
              ))}
            </nav>

            {activeTab === "details" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div className="space-y-5 md:col-span-2">
                  {ticket.anyDeskCode && (
                    <Alert
                      tone="neutral"
                      title="Código de acesso remoto (AnyDesk)"
                    >
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                        <p className="font-mono text-xl font-extrabold tracking-wide text-[var(--text)]">
                          {ticket.anyDeskCode}
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(ticket.anyDeskCode ?? "", "anydesk")
                          }
                        >
                          {copied === "anydesk" ? (
                            <Check
                              aria-hidden="true"
                              className="text-[var(--success)]"
                              size={16}
                            />
                          ) : (
                            <Copy aria-hidden="true" size={16} />
                          )}
                          <span aria-live="polite">
                            {copied === "anydesk" ? "Copiado" : "Copiar código"}
                          </span>
                        </Button>
                      </div>
                    </Alert>
                  )}

                  <div>
                    <h3 className={FIELD_LABEL}>Descrição da solicitação</h3>
                    <p className="mt-2 whitespace-pre-wrap rounded-[12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-sm leading-relaxed">
                      {ticket.freeTextDescription ||
                        "Sem descrição adicional informada."}
                    </p>
                  </div>

                  {ticket.status === "completed" &&
                    completionItems.length > 0 && (
                      <Card>
                        <CardHeader className="justify-start gap-2">
                          <CheckCircle
                            aria-hidden="true"
                            className="text-[var(--brand)]"
                            size={20}
                          />
                          <h3 className="font-bold">
                            Registro de conclusão técnica
                          </h3>
                        </CardHeader>
                        <CardContent>
                          <dl className="space-y-4">
                            {completionItems.map((item) => (
                              <div key={item.label}>
                                <dt className={FIELD_LABEL}>{item.label}</dt>
                                <dd className="mt-1 text-sm leading-relaxed">
                                  {item.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </CardContent>
                      </Card>
                    )}

                  {ticket.status === "completed" && (
                    <Card>
                      <CardContent className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">
                            Avaliação do atendimento
                          </h3>
                          {ticket.feedback ? (
                            <div className="mt-2 flex items-center gap-2">
                              <span
                                role="img"
                                aria-label={`Nota ${ticket.feedback.rating} de 5`}
                                className="flex"
                              >
                                {[1, 2, 3, 4, 5].map((star) => {
                                  const filled =
                                    star <= (ticket.feedback?.rating ?? 0);
                                  return (
                                    <Star
                                      key={star}
                                      aria-hidden="true"
                                      size={20}
                                      weight={filled ? "fill" : "regular"}
                                      className={
                                        filled
                                          ? "text-[var(--warning-strong)]"
                                          : "text-[var(--text-faint)]"
                                      }
                                    />
                                  );
                                })}
                              </span>
                              <span
                                aria-hidden="true"
                                className="text-sm font-medium"
                              >
                                {ticket.feedback.rating}/5
                              </span>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              O solicitante ainda não avaliou este atendimento.
                            </p>
                          )}
                          {ticket.feedback?.comment && (
                            <p className="mt-2 text-sm italic text-[var(--text-muted)]">
                              "{ticket.feedback.comment}"
                            </p>
                          )}
                        </div>
                        {isRequester && !ticket.hasFeedback && (
                          <Button
                            size="sm"
                            onClick={() => setFeedbackModalOpen(true)}
                          >
                            <Star aria-hidden="true" size={16} />
                            Avaliar atendimento
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>

                <dl className="h-fit space-y-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                  <div>
                    <dt className={FIELD_LABEL}>Solicitante</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {ticket.requesterName}
                    </dd>
                    {ticket.requesterEmail && (
                      <dd className="break-all text-xs text-[var(--text-muted)]">
                        {ticket.requesterEmail}
                      </dd>
                    )}
                    {ticket.unitName && (
                      <dd className="mt-1">
                        <Badge variant="neutral">{ticket.unitName}</Badge>
                      </dd>
                    )}
                  </div>

                  {ticket.beneficiaryName && (
                    <div className="border-t border-[var(--border)] pt-3">
                      <dt className={FIELD_LABEL}>Beneficiário do chamado</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {ticket.beneficiaryName}
                      </dd>
                    </div>
                  )}

                  <div className="border-t border-[var(--border)] pt-3">
                    <dt className={FIELD_LABEL}>Técnico responsável</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {ticket.technicianName || "Não atribuído"}
                    </dd>
                    {ticket.areaResponsavel && (
                      <dd className="mt-0.5 text-xs capitalize text-[var(--text-muted)]">
                        Área: {technicalAreaLabels[ticket.areaResponsavel]}
                      </dd>
                    )}
                  </div>

                  <div className="border-t border-[var(--border)] pt-3">
                    <dt className={FIELD_LABEL}>Modalidade</dt>
                    <dd className="mt-1 text-sm">
                      {ticket.isRemote
                        ? "Suporte remoto"
                        : "Presencial (na CGE)"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="space-y-4">
                <div
                  role="log"
                  aria-live="polite"
                  aria-label="Mensagens do chamado"
                  className="max-h-96 min-h-[220px] space-y-3 overflow-y-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
                >
                  {ticket.messages.length === 0 ? (
                    <EmptyState
                      title="Nenhuma mensagem"
                      description="Use o campo abaixo para conversar com a equipe."
                    />
                  ) : (
                    ticket.messages.map((m) => {
                      const isMe = m.authorAccountId === currentUser.account.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            isMe ? "items-end" : "items-start"
                          }`}
                        >
                          <p className="text-xs text-[var(--text-muted)]">
                            {m.authorName} •{" "}
                            {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p
                            className={`mt-1 max-w-md rounded-[14px] px-4 py-2.5 text-sm leading-relaxed ${
                              isMe
                                ? "bg-[var(--action)] text-[var(--action-foreground)]"
                                : "border border-[var(--border)] bg-[var(--surface)]"
                            }`}
                          >
                            {m.content}
                          </p>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    aria-label="Mensagem"
                    placeholder="Escreva uma mensagem…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sendingMsg}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={sendingMsg || !newMessage.trim()}
                  >
                    <PaperPlaneTilt aria-hidden="true" size={16} />
                    Enviar
                  </Button>
                </form>
              </div>
            )}

            {activeTab === "history" &&
              (ticket.events.length === 0 ? (
                <EmptyState
                  title="Sem eventos"
                  description="As mudanças de status do chamado aparecem aqui."
                />
              ) : (
                <ol className="space-y-4">
                  {ticket.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="border-l-2 border-[var(--brand)] py-1 pl-4"
                    >
                      <p className="flex flex-wrap items-center gap-x-2">
                        <span className="text-sm font-semibold">
                          {ev.actorName || "Sistema"}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(ev.createdAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                        {ev.note ||
                          `Status alterado para ${ticketStatus(ev.toStatus).label.toLowerCase()}`}
                      </p>
                    </li>
                  ))}
                </ol>
              ))}
          </div>
        )}
      </DialogContent>

      <Dialog open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
        <DialogContent
          title="Pausar atendimento"
          description="Informe a justificativa da pausa. O contador de SLA fica suspenso durante a pausa."
          className="max-w-md"
        >
          <div className="space-y-4">
            {actionAlert}
            <FormField htmlFor="pause-reason" label="Motivo da pausa">
              <Textarea
                id="pause-reason"
                rows={3}
                required
                placeholder="Ex.: aguardando peça de reposição, usuário ausente…"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setPauseModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={!pauseReason.trim() || actionLoading}
                onClick={handlePause}
              >
                {actionLoading ? "Pausando…" : "Pausar atendimento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent
          title="Concluir atendimento"
          description="Preencha os dados técnicos do fechamento para compor o histórico e a base de conhecimento."
        >
          <div className="space-y-4">
            {actionAlert}
            <FormField
              htmlFor="complete-cause"
              label={
                ticket?.requiresCauseSolution
                  ? "Causa do problema"
                  : "Causa do problema (opcional)"
              }
            >
              <Input
                id="complete-cause"
                required={ticket?.requiresCauseSolution}
                placeholder="Ex.: cabo de rede rompido, usuário bloqueado no AD…"
                value={cause}
                onChange={(e) => setCause(e.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="complete-solution"
              label={
                ticket?.requiresCauseSolution
                  ? "Solução aplicada"
                  : "Solução aplicada (opcional)"
              }
            >
              <Input
                id="complete-solution"
                required={ticket?.requiresCauseSolution}
                placeholder="Ex.: troca do conector RJ-45, desbloqueio de senha…"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="complete-note"
              label="Observações de encerramento (opcional)"
            >
              <Textarea
                id="complete-note"
                rows={2}
                placeholder="Orientações dadas ao usuário ou notas adicionais…"
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setCompleteModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  actionLoading ||
                  (ticket?.requiresCauseSolution &&
                    (!cause.trim() || !solution.trim()))
                }
                onClick={handleComplete}
              >
                {actionLoading ? "Concluindo…" : "Concluir chamado"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent
          title="Cancelar chamado"
          description="Informe a justificativa do cancelamento deste chamado."
          className="max-w-md"
        >
          <div className="space-y-4">
            {actionAlert}
            <FormField
              htmlFor="cancel-reason"
              label="Justificativa do cancelamento"
            >
              <Textarea
                id="cancel-reason"
                rows={3}
                required
                placeholder="Ex.: chamado em duplicidade, problema resolvido pelo usuário…"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setCancelModalOpen(false)}
              >
                Voltar
              </Button>
              <Button
                variant="danger"
                disabled={!cancelReason.trim() || actionLoading}
                onClick={handleCancel}
              >
                {actionLoading ? "Cancelando…" : "Cancelar chamado"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
        <DialogContent
          title={
            approvalDecision === "approve"
              ? "Aprovar solicitação de TI"
              : "Rejeitar solicitação de TI"
          }
          description={
            approvalDecision === "approve"
              ? "Ao aprovar, o chamado é liberado para atendimento pela equipe técnica da ATEC."
              : "Ao rejeitar, o chamado é cancelado automaticamente."
          }
          className="max-w-md"
        >
          <div className="space-y-4">
            {actionAlert}
            <FormField
              htmlFor="approval-note"
              label={
                approvalDecision === "approve"
                  ? "Observações (opcional)"
                  : "Justificativa da rejeição"
              }
            >
              <Textarea
                id="approval-note"
                rows={3}
                required={approvalDecision === "reject"}
                placeholder={
                  approvalDecision === "approve"
                    ? "Observações para a equipe de TI…"
                    : "Motivo da recusa da solicitação…"
                }
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setApprovalModalOpen(false)}
              >
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
                {actionLoading
                  ? "Registrando…"
                  : approvalDecision === "approve"
                    ? "Confirmar aprovação"
                    : "Confirmar rejeição"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent
          title="Avaliar atendimento"
          description="Sua opinião ajuda a melhorar o suporte de TI da Controladoria Geral do Estado."
          className="max-w-md"
        >
          <div className="space-y-4">
            {actionAlert}
            <div
              role="radiogroup"
              aria-label="Nota do atendimento"
              className="flex justify-center gap-1"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= feedbackRating;
                return (
                  <Button
                    key={star}
                    variant="quiet"
                    size="icon"
                    role="radio"
                    aria-checked={star === feedbackRating}
                    aria-label={`${star} de 5`}
                    onClick={() => setFeedbackRating(star)}
                  >
                    <Star
                      aria-hidden="true"
                      size={32}
                      weight={filled ? "fill" : "regular"}
                      className={
                        filled
                          ? "text-[var(--warning-strong)]"
                          : "text-[var(--text-faint)]"
                      }
                    />
                  </Button>
                );
              })}
            </div>
            <FormField
              htmlFor="feedback-comment"
              label="Comentário adicional (opcional)"
            >
              <Textarea
                id="feedback-comment"
                rows={3}
                placeholder="Conte como foi o atendimento…"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setFeedbackModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button disabled={actionLoading} onClick={handleFeedbackSubmit}>
                {actionLoading ? "Enviando…" : "Enviar avaliação"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

const FIELD_LABEL =
  "text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]";
