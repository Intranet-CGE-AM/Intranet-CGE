import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type {
  TicketCategory,
  TicketCreateInput,
  TicketDetail,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormField,
  Input,
  Textarea,
} from "@cge/ui";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  Desktop,
  FileText,
  HardDrives,
  Lightbulb,
  MonitorArrowUp,
  Printer,
  ShieldCheck,
  WifiHigh,
  type Icon,
} from "@phosphor-icons/react";

import { api, json } from "../lib/api";

const CATEGORY_ICONS: Record<string, Icon> = {
  HARDWARE: Desktop,
  Desktop: Desktop,
  NETWORK: WifiHigh,
  WifiHigh: WifiHigh,
  NETSERVER: HardDrives,
  HardDrives: HardDrives,
  SIGED: FileText,
  FileText: FileText,
  PRINTER: Printer,
  Printer: Printer,
  REMOTE: MonitorArrowUp,
  MonitorArrowUp: MonitorArrowUp,
};

export function NewTicketPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [selectedCategory, setSelectedCategory] =
    useState<TicketCategory | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] =
    useState<string>("");
  const [freeTextDescription, setFreeTextDescription] = useState("");
  const [anyDeskCode, setAnyDeskCode] = useState("");

  // Beneficiary
  const [isForOther, setIsForOther] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryDept, setBeneficiaryDept] = useState("");
  const [beneficiaryEmail, setBeneficiaryEmail] = useState("");

  // Printer counters
  const [monoCounter, setMonoCounter] = useState("");
  const [colorCounter, setColorCounter] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<TicketDetail | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await api<{ categories: TicketCategory[] }>(
          "/api/tickets/categories",
        );
        setCategories(data.categories);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar as categorias de suporte.",
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const selectedSubcategory =
    selectedCategory?.subcategories.find(
      (s) => s.id === selectedSubcategoryId,
    ) ?? null;

  const isRemote = selectedCategory?.code === "REMOTE";

  const handleCategorySelect = (cat: TicketCategory) => {
    setSelectedCategory(cat);
    setSelectedSubcategoryId("");
    setAnyDeskCode("");
    setFreeTextDescription("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedCategory) return;

    if (
      !isRemote &&
      !selectedSubcategoryId &&
      !selectedCategory.allowsFreeText
    ) {
      setFormError("Por favor, selecione um tipo de problema.");
      return;
    }

    if (isRemote && !anyDeskCode.trim()) {
      setFormError(
        "Por favor, informe o código do AnyDesk para suporte remoto.",
      );
      return;
    }

    if (
      !freeTextDescription.trim() &&
      (selectedCategory.allowsFreeText || isRemote)
    ) {
      setFormError("Por favor, detalhe sua solicitação na descrição.");
      return;
    }

    const payload: TicketCreateInput = {
      categoryId: selectedCategory.id,
      subcategoryId: selectedSubcategoryId || undefined,
      freeTextDescription: freeTextDescription.trim() || undefined,
      anyDeskCode: isRemote ? anyDeskCode.trim() : undefined,
      beneficiaryName: isForOther
        ? beneficiaryName.trim() || undefined
        : undefined,
      beneficiaryDept: isForOther
        ? beneficiaryDept.trim() || undefined
        : undefined,
      beneficiaryEmail: isForOther
        ? beneficiaryEmail.trim() || undefined
        : undefined,
      extraData:
        monoCounter || colorCounter
          ? {
              monoCounter: monoCounter.trim() || undefined,
              colorCounter: colorCounter.trim() || undefined,
            }
          : undefined,
    };

    try {
      setSubmitting(true);
      const res = await api<TicketDetail>("/api/tickets", {
        method: "POST",
        body: json(payload),
      });
      setCreatedTicket(res);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Erro ao abrir chamado de suporte.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdTicket) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[var(--text)]">
              Chamado Aberto com Sucesso!
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Sua solicitação foi registrada no suporte técnico da CGE e já está
              na fila de atendimento da ATEC.
            </p>

            <div className="my-6 inline-block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-4 shadow-sm">
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                Protocolo de Atendimento
              </span>
              <div className="font-mono text-2xl font-black text-[var(--brand)]">
                #{createdTicket.ticketNumber}
              </div>
            </div>

            {createdTicket.approvalStatus === "pending" && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-left text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Aprovação da Chefia Necessária</span>
                </div>
                <p className="mt-1">
                  Este tipo de solicitação foi enviado para deliberação da
                  chefia do seu setor. O atendimento pela ATEC começará assim
                  que for aprovado.
                </p>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button
                variant="quiet"
                onClick={() => {
                  setCreatedTicket(null);
                  setSelectedCategory(null);
                }}
              >
                Abrir Outro Chamado
              </Button>
              <Button variant="primary" onClick={() => navigate("/suporte")}>
                Acompanhar Chamados
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => navigate("/suporte")}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Novo Chamado de TI
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Selecione a categoria do problema para direcionamento à equipe da
              ATEC
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="Não foi possível carregar categorias">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center space-x-3 text-[var(--text-muted)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
          <span>Carregando categorias de suporte...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ── Grid de Categorias ───────────────────────────────────────── */}
          <div>
            <label className="text-sm font-semibold text-[var(--text)]">
              1. Selecione a Categoria do Atendimento
            </label>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => {
                const isSelected = selectedCategory?.id === cat.id;
                const IconComp =
                  CATEGORY_ICONS[cat.code] ||
                  CATEGORY_ICONS[cat.icon || "Desktop"] ||
                  Desktop;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    className={`flex flex-col items-start rounded-2xl border p-5 text-left transition-all duration-200 ${
                      isSelected
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-md ring-2 ring-[var(--brand)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]/50 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl transition ${
                          isSelected
                            ? "bg-[var(--action)] text-white"
                            : "bg-[var(--surface-subtle)] text-[var(--brand)]"
                        }`}
                      >
                        <IconComp className="h-6 w-6" />
                      </div>
                      {cat.slaHours && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                          <Clock className="h-3 w-3" /> {cat.slaHours}h SLA
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 font-semibold text-[var(--text)]">
                      {cat.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                      {cat.code === "REMOTE"
                        ? "Conexão remota imediata via AnyDesk na sua estação de trabalho"
                        : cat.subcategories.length > 0
                          ? `${cat.subcategories.length} opções de atendimento disponíveis`
                          : "Suporte geral para este serviço"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Subcategoria & Formulário Específico ──────────────────────── */}
          {formError && (
            <Alert tone="danger" title="Atenção">
              {formError}
            </Alert>
          )}

          {selectedCategory && (
            <Card className="animate-in fade-in-50 duration-300">
              <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text)]">
                    2. Detalhamento do Chamado: {selectedCategory.name}
                  </h3>
                  <Badge variant="brand">
                    SLA: {selectedCategory.slaHours ?? 4} horas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {/* Dicas N1 Instantâneas */}
                {selectedCategory.n1Tips && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <Lightbulb className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-bold">
                        Orientação de Autoatendimento (N1):
                      </span>
                      <p className="mt-0.5 leading-relaxed">
                        {selectedCategory.n1Tips}
                      </p>
                    </div>
                  </div>
                )}

                {/* Subcategoria Select se houver */}
                {selectedCategory.subcategories.length > 0 && (
                  <FormField
                    htmlFor="subcategory-select"
                    label="Tipo de Solicitação / Problema"
                  >
                    <select
                      id="subcategory-select"
                      value={selectedSubcategoryId}
                      onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
                    >
                      <option value="">
                        Selecione o problema específico...
                      </option>
                      {selectedCategory.subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}{" "}
                          {sub.requiresApproval ? " (Requer Aprovação)" : ""}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}

                {/* Alerta de Aprovação da Chefia se aplicável */}
                {selectedSubcategory?.requiresApproval && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50 p-3.5 text-xs text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
                    <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      Esta solicitação exige{" "}
                      <strong>aprovação da chefia do setor</strong> antes de ser
                      atendida pelos técnicos da ATEC.
                    </span>
                  </div>
                )}

                {/* Código AnyDesk se Suporte Remoto */}
                {isRemote && (
                  <div className="space-y-2 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                    <FormField
                      htmlFor="anydesk-code"
                      label="Código AnyDesk da sua máquina"
                      hint="Abra o AnyDesk no seu computador e informe o código de 9 ou 10 dígitos."
                    >
                      <Input
                        id="anydesk-code"
                        placeholder="Ex: 123 456 789"
                        value={anyDeskCode}
                        onChange={(e) => setAnyDeskCode(e.target.value)}
                        className="font-mono text-base font-bold tracking-wider"
                      />
                    </FormField>
                  </div>
                )}

                {/* Contadores de Impressora se formType === 'printer_counter' */}
                {selectedSubcategory?.formType === "printer_counter" && (
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-2">
                    <FormField
                      htmlFor="mono-counter"
                      label="Contador Monocromático (Preto & Branco)"
                      hint="Número total de páginas P&B"
                    >
                      <Input
                        id="mono-counter"
                        placeholder="Ex: 15420"
                        value={monoCounter}
                        onChange={(e) => setMonoCounter(e.target.value)}
                      />
                    </FormField>
                    <FormField
                      htmlFor="color-counter"
                      label="Contador Colorido"
                      hint="Número total de páginas coloridas"
                    >
                      <Input
                        id="color-counter"
                        placeholder="Ex: 3410"
                        value={colorCounter}
                        onChange={(e) => setColorCounter(e.target.value)}
                      />
                    </FormField>
                  </div>
                )}

                {/* Descrição em Texto Livre */}
                <FormField
                  htmlFor="free-description"
                  label="Descrição Detalhada do Problema"
                  hint="Descreva o que está acontecendo com o máximo de detalhes possível para agilizar o suporte."
                >
                  <Textarea
                    id="free-description"
                    rows={4}
                    placeholder="Descreva a falha, mensagens de erro exibidas na tela, programas afetados..."
                    value={freeTextDescription}
                    onChange={(e) => setFreeTextDescription(e.target.value)}
                  />
                </FormField>

                {/* Beneficiário Toggle ("Abrir para outro servidor") */}
                {selectedCategory.allowsBeneficiary && (
                  <div className="border-t border-[var(--border)] pt-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--text)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isForOther}
                        onChange={(e) => setIsForOther(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border)] text-[var(--brand)]"
                      />
                      <span>
                        Estou abrindo este chamado para outro
                        servidor/colaborador
                      </span>
                    </label>

                    {isForOther && (
                      <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-3">
                        <FormField
                          htmlFor="beneficiary-name"
                          label="Nome do Beneficiário"
                        >
                          <Input
                            id="beneficiary-name"
                            placeholder="Nome completo..."
                            value={beneficiaryName}
                            onChange={(e) => setBeneficiaryName(e.target.value)}
                          />
                        </FormField>
                        <FormField
                          htmlFor="beneficiary-dept"
                          label="Setor / Unidade"
                        >
                          <Input
                            id="beneficiary-dept"
                            placeholder="Ex: Gabinete, Ouvidoria..."
                            value={beneficiaryDept}
                            onChange={(e) => setBeneficiaryDept(e.target.value)}
                          />
                        </FormField>
                        <FormField
                          htmlFor="beneficiary-email"
                          label="E-mail do Beneficiário"
                        >
                          <Input
                            id="beneficiary-email"
                            placeholder="email@cge.am.gov.br"
                            value={beneficiaryEmail}
                            onChange={(e) =>
                              setBeneficiaryEmail(e.target.value)
                            }
                          />
                        </FormField>
                      </div>
                    )}
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => setSelectedCategory(null)}
                  >
                    Trocar Categoria
                  </Button>
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? (
                      "Abrindo chamado..."
                    ) : (
                      <>
                        <Check className="mr-1.5 h-4 w-4" /> Registrar Chamado
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      )}
    </div>
  );
}
