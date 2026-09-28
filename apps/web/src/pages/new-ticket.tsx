import { useState, useEffect, type ReactNode } from "react";
import { Link } from "react-router";
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
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@cge/ui";
import {
  ArrowLeft,
  Clock,
  Desktop,
  FileText,
  HardDrives,
  MonitorArrowUp,
  Printer,
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

type FieldErrors = Partial<
  Record<"subcategory" | "anyDesk" | "description", string>
>;

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <Button asChild size="sm" variant="quiet" className="-ml-3 mb-2">
        <Link to="/suporte">
          <ArrowLeft aria-hidden="true" size={16} />
          Voltar
        </Link>
      </Button>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        Suporte
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
        {title}
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

export function NewTicketPage() {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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

  async function loadCategories() {
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

  useEffect(() => {
    void loadCategories();
  }, []);

  const selectedSubcategory =
    selectedCategory?.subcategories.find(
      (s) => s.id === selectedSubcategoryId,
    ) ?? null;

  const isRemote = selectedCategory?.code === "REMOTE";
  const descriptionRequired = Boolean(
    selectedCategory && (selectedCategory.allowsFreeText || isRemote),
  );

  const handleCategorySelect = (cat: TicketCategory) => {
    setSelectedCategory(cat);
    setSelectedSubcategoryId("");
    setAnyDeskCode("");
    setFreeTextDescription("");
    setFormError(null);
    setFieldErrors({});
  };

  const resetForm = () => {
    setCreatedTicket(null);
    setSelectedCategory(null);
    setSelectedSubcategoryId("");
    setAnyDeskCode("");
    setFreeTextDescription("");
    setIsForOther(false);
    setBeneficiaryName("");
    setBeneficiaryDept("");
    setBeneficiaryEmail("");
    setMonoCounter("");
    setColorCounter("");
    setFormError(null);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedCategory) return;

    const errors: FieldErrors = {};
    if (
      !isRemote &&
      !selectedSubcategoryId &&
      !selectedCategory.allowsFreeText
    ) {
      errors.subcategory = "Selecione o tipo de solicitação.";
    }
    if (isRemote && !anyDeskCode.trim()) {
      errors.anyDesk = "Informe o código do AnyDesk para o suporte remoto.";
    }
    if (!freeTextDescription.trim() && descriptionRequired) {
      errors.description = "Descreva a sua solicitação.";
    }
    setFieldErrors(errors);
    const firstInvalid = errors.subcategory
      ? "subcategory-select"
      : errors.anyDesk
        ? "anydesk-code"
        : errors.description
          ? "free-description"
          : null;
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
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
          : "Não foi possível abrir o chamado. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdTicket) {
    return (
      <div className="page-enter space-y-4">
        <PageHeader
          title="Chamado aberto"
          description="Sua solicitação foi registrada e já está na fila de atendimento da ATEC."
        />

        <Card className="max-w-2xl">
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                Protocolo de atendimento
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-[var(--brand)]">
                #{createdTicket.ticketNumber.replace(/^#+/, "")}
              </p>
            </div>

            {createdTicket.approvalStatus === "pending" && (
              <Alert tone="warning" title="Aprovação da chefia necessária">
                Este tipo de solicitação foi enviado para a chefia do seu setor.
                O atendimento pela ATEC começa assim que for aprovado.
              </Alert>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={resetForm}>
                Abrir outro chamado
              </Button>
              <Button asChild>
                <Link to="/suporte">Acompanhar chamados</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  let categoryContent: ReactNode;
  if (loading) {
    categoryContent = (
      <div
        aria-label="Carregando categorias"
        role="status"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-[14px]" />
        ))}
      </div>
    );
  } else if (error) {
    categoryContent = null;
  } else if (categories.length === 0) {
    categoryContent = (
      <Card>
        <EmptyState
          title="Nenhuma categoria disponível"
          description="Não há categorias de atendimento ativas no momento. Procure a ATEC."
        />
      </Card>
    );
  } else {
    categoryContent = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              aria-pressed={isSelected}
              onClick={() => handleCategorySelect(cat)}
              className={`flex flex-col items-start rounded-[14px] border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] ${
                isSelected
                  ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <IconComp
                  aria-hidden="true"
                  className="text-[var(--brand)]"
                  size={24}
                />
                {cat.slaHours ? (
                  <Badge variant="neutral" className="gap-1">
                    <Clock aria-hidden="true" size={14} />
                    SLA {cat.slaHours}h
                  </Badge>
                ) : null}
              </div>
              <h3 className="mt-4 font-bold">{cat.name}</h3>
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
    );
  }

  return (
    <div className="page-enter space-y-4">
      <PageHeader
        title="Novo chamado de TI"
        description="Escolha a categoria do problema para direcionar o atendimento à equipe da ATEC."
      />

      {error && (
        <Alert tone="danger" title="Não foi possível carregar as categorias">
          <p>{error}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={() => void loadCategories()}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <section
          aria-labelledby="ticket-category-heading"
          className="space-y-3"
        >
          <div>
            <h2 id="ticket-category-heading" className="font-bold">
              Categoria do atendimento
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Selecione a área que mais se aproxima do seu problema.
            </p>
          </div>
          {categoryContent}
        </section>

        {formError && (
          <Alert tone="danger" title="Não foi possível abrir o chamado">
            {formError}
          </Alert>
        )}

        {selectedCategory && (
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Detalhes do chamado</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {selectedCategory.name}
                </p>
              </div>
              {selectedCategory.slaHours ? (
                <Badge variant="brand" className="shrink-0">
                  SLA: {selectedCategory.slaHours} horas
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCategory.n1Tips && (
                <Alert tone="warning" title="Orientação de autoatendimento">
                  {selectedCategory.n1Tips}
                </Alert>
              )}

              {selectedCategory.subcategories.length > 0 && (
                <FormField
                  htmlFor="subcategory-select"
                  label={
                    selectedCategory.allowsFreeText || isRemote
                      ? "Tipo de solicitação (opcional)"
                      : "Tipo de solicitação"
                  }
                  error={fieldErrors.subcategory}
                >
                  <Select
                    id="subcategory-select"
                    name="subcategory"
                    placeholder="Selecione o tipo de solicitação"
                    aria-invalid={Boolean(fieldErrors.subcategory)}
                    value={selectedSubcategoryId}
                    onValueChange={setSelectedSubcategoryId}
                    options={selectedCategory.subcategories.map((sub) => ({
                      value: sub.id,
                      label: sub.requiresApproval
                        ? `${sub.name} (requer aprovação)`
                        : sub.name,
                    }))}
                  />
                </FormField>
              )}

              {selectedSubcategory?.requiresApproval && (
                <Alert tone="neutral" title="Requer aprovação da chefia">
                  Esta solicitação precisa da aprovação da chefia do setor antes
                  de ser atendida pelos técnicos da ATEC.
                </Alert>
              )}

              {isRemote && (
                <FormField
                  htmlFor="anydesk-code"
                  label="Código AnyDesk da sua máquina"
                  hint="Abra o AnyDesk no seu computador e informe o código de 9 ou 10 dígitos."
                  error={fieldErrors.anyDesk}
                >
                  <Input
                    id="anydesk-code"
                    required
                    aria-invalid={Boolean(fieldErrors.anyDesk)}
                    placeholder="Ex.: 123 456 789"
                    value={anyDeskCode}
                    onChange={(e) => setAnyDeskCode(e.target.value)}
                    className="font-mono tracking-wider"
                  />
                </FormField>
              )}

              {selectedSubcategory?.formType === "printer_counter" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    htmlFor="mono-counter"
                    label="Contador monocromático (opcional)"
                    hint="Total de páginas em preto e branco."
                  >
                    <Input
                      id="mono-counter"
                      inputMode="numeric"
                      placeholder="Ex.: 15420"
                      value={monoCounter}
                      onChange={(e) => setMonoCounter(e.target.value)}
                    />
                  </FormField>
                  <FormField
                    htmlFor="color-counter"
                    label="Contador colorido (opcional)"
                    hint="Total de páginas coloridas."
                  >
                    <Input
                      id="color-counter"
                      inputMode="numeric"
                      placeholder="Ex.: 3410"
                      value={colorCounter}
                      onChange={(e) => setColorCounter(e.target.value)}
                    />
                  </FormField>
                </div>
              )}

              <FormField
                htmlFor="free-description"
                label={
                  descriptionRequired
                    ? "Descrição do problema"
                    : "Descrição do problema (opcional)"
                }
                hint="Conte o que está acontecendo com o máximo de detalhes para agilizar o atendimento."
                error={fieldErrors.description}
              >
                <Textarea
                  id="free-description"
                  rows={4}
                  required={descriptionRequired}
                  aria-invalid={Boolean(fieldErrors.description)}
                  placeholder="Falha, mensagens de erro exibidas na tela, programas afetados…"
                  value={freeTextDescription}
                  onChange={(e) => setFreeTextDescription(e.target.value)}
                />
              </FormField>

              {selectedCategory.allowsBeneficiary && (
                <div className="space-y-4 border-t border-[var(--border)] pt-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={isForOther}
                      onChange={(e) => setIsForOther(e.target.checked)}
                      className="size-4 accent-[var(--brand)]"
                    />
                    Estou abrindo este chamado para outro servidor ou
                    colaborador
                  </label>

                  {isForOther && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        htmlFor="beneficiary-name"
                        label="Nome do beneficiário (opcional)"
                      >
                        <Input
                          id="beneficiary-name"
                          autoComplete="off"
                          placeholder="Nome completo"
                          value={beneficiaryName}
                          onChange={(e) => setBeneficiaryName(e.target.value)}
                        />
                      </FormField>
                      <FormField
                        htmlFor="beneficiary-dept"
                        label="Setor ou unidade (opcional)"
                      >
                        <Input
                          id="beneficiary-dept"
                          placeholder="Ex.: Gabinete, Ouvidoria"
                          value={beneficiaryDept}
                          onChange={(e) => setBeneficiaryDept(e.target.value)}
                        />
                      </FormField>
                      <FormField
                        htmlFor="beneficiary-email"
                        label="E-mail do beneficiário (opcional)"
                        className="sm:col-span-2"
                      >
                        <Input
                          id="beneficiary-email"
                          type="email"
                          autoComplete="off"
                          placeholder="nome@cge.am.gov.br"
                          value={beneficiaryEmail}
                          onChange={(e) => setBeneficiaryEmail(e.target.value)}
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedCategory(null)}
                >
                  Trocar categoria
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Abrindo chamado…" : "Abrir chamado"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
