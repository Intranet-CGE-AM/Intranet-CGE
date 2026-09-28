// Operate: estrutura existente, quadro previsto e associações reais na mesma consulta.
// Extensão institucional code-led: unidade primeiro, árvore/tabela sem diagrama arrastável,
// edição em linha com consequências explícitas; nenhuma nova identidade ou saldo oficial.
import { type Organization, type PositionInput } from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, json } from "../lib/api";

type Unit = Organization["units"][number];
type Position = Unit["positions"][number];
type Editor =
  | {
      kind: "position";
      initial: Position | null;
      input: PositionInput;
      confirmed: boolean;
    }
  | { kind: "parent"; parentId: string }
  | {
      kind: "assignment";
      member: Unit["employments"][number];
      positionId: string;
    };
const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm disabled:opacity-50";
const errorMessage = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "Não foi possível concluir. Tente novamente.";
const vacancies = (value: number) =>
  value < 0 ? `${-value} acima do previsto` : String(value);

function UnitTree({
  units,
  parentId = null,
  selected,
  disabled,
  onSelect,
  ancestors = [],
}: {
  units: Unit[];
  parentId?: string | null;
  selected: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  ancestors?: string[];
}) {
  const children = units.filter(
    (unit) => unit.parentId === parentId && !ancestors.includes(unit.id),
  );
  if (!children.length) return null;
  return (
    <ul
      aria-label={parentId === null ? "Hierarquia de unidades" : undefined}
      className={
        parentId ? "ml-4 border-l border-[var(--border)] pl-3" : "space-y-1"
      }
    >
      {children.map((unit) => (
        <li key={unit.id}>
          <Button
            className="min-h-11 max-w-full justify-start whitespace-normal text-left"
            variant={selected === unit.id ? "secondary" : "quiet"}
            disabled={disabled}
            onClick={() => onSelect(unit.id)}
            aria-pressed={selected === unit.id}
          >
            {unit.name}{" "}
            <span className="whitespace-nowrap font-normal">
              ({unit.peopleCount}{" "}
              {unit.peopleCount === 1 ? "pessoa" : "pessoas"})
            </span>
          </Button>
          {unit.parentOutsideScope && (
            <p className="text-xs text-[var(--text-muted)]">
              Unidade superior fora do seu escopo.
            </p>
          )}
          <UnitTree
            units={units}
            parentId={unit.id}
            selected={selected}
            disabled={disabled}
            onSelect={onSelect}
            ancestors={[...ancestors, unit.id]}
          />
        </li>
      ))}
    </ul>
  );
}

export function OrganizationPage() {
  const [data, setData] = useState<Organization | null>(null);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<"tree" | "table">("tree");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [referenceUpdated, setReferenceUpdated] = useState(false);
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void api<Organization>("/api/organization", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setSelected((current) =>
            result.units.some((unit) => unit.id === current)
              ? current
              : (result.units[0]?.id ?? ""),
          );
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(cause));
          setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (editor?.kind === "position")
      document.getElementById("position-code")?.focus();
    if (editor?.kind === "parent")
      document.getElementById("organization-parent")?.focus();
  }, [editor?.kind]);
  const unit = data?.units.find((item) => item.id === selected);
  const blocked = loading || Boolean(editor);
  const excess =
    editor?.kind === "position" &&
    editor.initial &&
    editor.input.plannedCount < editor.initial.plannedCount
      ? Math.max(0, editor.initial.occupiedCount - editor.input.plannedCount)
      : 0;
  function edit(next: Editor) {
    setEditor(next);
    setError("");
    setMessage("");
    setConflict(false);
    setReferenceUpdated(false);
  }
  function close() {
    setEditor(null);
    setError("");
    setConflict(false);
    setReferenceUpdated(false);
  }
  async function refreshReference() {
    if (!editor || saving) return;
    setSaving(true);
    try {
      const result = await api<Organization>("/api/organization");
      const current = result.units.find(
        (item) => item.id === selected && item.canManage,
      );
      if (
        !current ||
        (editor.kind === "parent" && current.parentOutsideScope)
      ) {
        setError(
          "Esta unidade não está mais disponível para edição no seu escopo. Seus campos foram mantidos para consulta.",
        );
        return;
      }
      if (editor.kind === "position" && editor.initial) {
        const initial = current.positions.find(
          (job) => job.id === editor.initial!.id,
        );
        if (!initial) {
          setError(
            "O cargo não está mais disponível. Seus campos foram mantidos para consulta.",
          );
          return;
        }
        setEditor({ ...editor, initial, confirmed: false });
      } else if (editor.kind === "assignment") {
        const member = current.employments.find(
          (item) => item.id === editor.member.id,
        );
        if (!member) {
          setError(
            "O vínculo não está mais ativo nesta unidade. Sua seleção foi mantida para consulta.",
          );
          return;
        }
        setEditor({ ...editor, member });
      }
      setData(result);
      setError("");
      setConflict(false);
      setReferenceUpdated(true);
      requestAnimationFrame(() => statusRef.current?.focus());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || !unit || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    setConflict(false);
    setReferenceUpdated(false);
    try {
      if (editor.kind === "position") {
        await api(
          `/api/organization/positions${editor.initial ? `/${editor.initial.id}` : ""}`,
          {
            method: editor.initial ? "PUT" : "POST",
            body: json({
              ...editor.input,
              ...(editor.initial
                ? {
                    version: editor.initial.version,
                    confirmBelowOccupancy: editor.confirmed,
                  }
                : {}),
            }),
          },
        );
        setMessage("Cargo salvo.");
      } else if (editor.kind === "parent") {
        await api(`/api/organization/units/${unit.id}/parent`, {
          method: "PUT",
          body: json({
            parentId: editor.parentId || null,
            expectedParentId: unit.parentId,
          }),
        });
        setMessage("Hierarquia salva.");
      } else {
        await api(
          `/api/organization/employments/${editor.member.id}/position`,
          {
            method: "POST",
            body: json({
              positionId: editor.positionId || null,
              version: editor.member.version,
            }),
          },
        );
        setMessage("Associação salva.");
      }
      setEditor(null);
      setRevision((value) => value + 1);
      requestAnimationFrame(() => statusRef.current?.focus());
    } catch (cause) {
      setError(errorMessage(cause));
      setConflict(cause instanceof ApiError && cause.status === 409);
    } finally {
      setSaving(false);
    }
  }
  const formActions = (
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11" type="submit" disabled={saving}>
        {saving
          ? "Salvando…"
          : editor?.kind === "position"
            ? "Salvar cargo"
            : "Salvar hierarquia"}
      </Button>
      <Button
        className="min-h-11"
        type="button"
        variant="quiet"
        disabled={saving}
        onClick={close}
      >
        Fechar formulário
      </Button>
    </div>
  );
  return (
    <div className="min-w-0 space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Estrutura e cargos
        </h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--text-muted)]">
          Consulte suas unidades autorizadas e associe vínculos ao quadro de
          cargos. Vagas são a diferença entre quantidade prevista e ocupação
          atual.
        </p>
      </header>
      {message && (
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="text-sm font-semibold text-[var(--success)]"
        >
          {message}
        </p>
      )}
      {loadError && (
        <Alert
          title={
            message
              ? "Salvo; a consulta precisa ser atualizada"
              : "Estrutura não carregada"
          }
          tone="danger"
        >
          <p>{loadError}</p>
          <Button
            className="mt-3 min-h-11"
            variant="secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}
      {loading && (
        <p role="status" className="text-sm">
          Atualizando estrutura…
        </p>
      )}
      {data && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
              <FormField label="Unidade consultada" htmlFor="organization-unit">
                <select
                  id="organization-unit"
                  className={selectClass}
                  value={selected}
                  disabled={blocked}
                  onChange={(event) => {
                    setSelected(event.target.value);
                    setMessage("");
                  }}
                >
                  {!data.units.length && (
                    <option value="">Nenhuma unidade disponível</option>
                  )}
                  {data.units.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <Button
              className="min-h-11"
              variant="secondary"
              disabled={blocked}
              onClick={() => setRevision((value) => value + 1)}
            >
              Atualizar estrutura
            </Button>
          </div>
          {!data.units.length ? (
            <p>Nenhuma unidade no seu escopo.</p>
          ) : (
            <section
              className="space-y-3"
              aria-label="Visão geral da estrutura"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-lg font-bold">Unidades</h2>
                <Button
                  className="min-h-11"
                  variant="secondary"
                  aria-pressed={view === "tree"}
                  disabled={blocked}
                  onClick={() => setView("tree")}
                >
                  Árvore
                </Button>
                <Button
                  className="min-h-11"
                  variant="secondary"
                  aria-pressed={view === "table"}
                  disabled={blocked}
                  onClick={() => setView("table")}
                >
                  Tabela
                </Button>
              </div>
              {view === "tree" ? (
                <UnitTree
                  units={data.units}
                  selected={selected}
                  disabled={blocked}
                  onSelect={(id) => {
                    setSelected(id);
                    setMessage("");
                  }}
                />
              ) : (
                <Table aria-label="Estrutura por unidade">
                  <thead>
                    <TableRow>
                      {[
                        "Unidade",
                        "Chefia",
                        "Pessoas",
                        "Cargos ativos",
                        "Ocupação",
                        "Vagas",
                      ].map((label) => (
                        <TableHead key={label} scope="col">
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </thead>
                  <tbody>
                    {data.units.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Button
                            className="min-h-11 whitespace-normal text-left"
                            variant="quiet"
                            disabled={blocked}
                            onClick={() => setSelected(item.id)}
                          >
                            {item.name}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {item.chiefs.map((chief) => chief.name).join(", ") ||
                            "Não informada"}
                        </TableCell>
                        <TableCell>{item.peopleCount}</TableCell>
                        <TableCell>
                          {item.positions.filter((job) => job.active).length}
                        </TableCell>
                        <TableCell>
                          {item.positions.reduce(
                            (sum, job) => sum + job.occupiedCount,
                            0,
                          )}
                        </TableCell>
                        <TableCell>
                          {vacancies(
                            item.positions
                              .filter((job) => job.active)
                              .reduce((sum, job) => sum + job.vacancies, 0),
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          )}
          {unit && (
            <section
              className="min-w-0 space-y-5 border-t border-[var(--border)] pt-6"
              aria-labelledby="organization-selected"
            >
              <header className="space-y-2">
                <h2 id="organization-selected" className="text-lg font-bold">
                  {unit.name}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {unit.code} · {unit.peopleCount}{" "}
                  {unit.peopleCount === 1 ? "pessoa" : "pessoas"} com vínculo
                  ativo · Chefia:{" "}
                  {unit.chiefs.map((chief) => chief.name).join(", ") ||
                    "não informada"}
                </p>
                <p className="text-sm">
                  Unidade superior:{" "}
                  {unit.parentOutsideScope
                    ? "fora do seu escopo"
                    : (data.units.find((item) => item.id === unit.parentId)
                        ?.name ?? "sem unidade superior")}
                </p>
                {unit.canManage && (
                  <Button
                    className="min-h-11"
                    variant="secondary"
                    disabled={blocked || unit.parentOutsideScope}
                    onClick={() =>
                      edit({ kind: "parent", parentId: unit.parentId ?? "" })
                    }
                  >
                    Alterar unidade superior
                  </Button>
                )}
              </header>
              {error && (
                <Alert title="Alteração não salva" tone="danger">
                  <p>{error}</p>
                  <p>
                    Os campos foram preservados. Revise ou tente salvar
                    novamente.
                  </p>
                  {conflict && (
                    <Button
                      className="mt-3 min-h-11"
                      variant="secondary"
                      disabled={saving}
                      onClick={refreshReference}
                    >
                      Atualizar dados sem perder edição
                    </Button>
                  )}
                </Alert>
              )}
              {referenceUpdated && (
                <Alert title="Revise antes de salvar" tone="warning">
                  <p ref={statusRef} tabIndex={-1}>
                    Dados atuais carregados. Sua edição foi mantida. Compare com
                    os dados atuais exibidos nesta consulta e salve novamente
                    apenas se desejar aplicar suas alterações.
                  </p>
                </Alert>
              )}
              {editor?.kind === "parent" && (
                <form onSubmit={save}>
                  <fieldset disabled={saving} className="space-y-4">
                    <FormField
                      label="Unidade superior"
                      htmlFor="organization-parent"
                    >
                      <select
                        id="organization-parent"
                        className={selectClass}
                        value={editor.parentId}
                        onChange={(event) =>
                          setEditor({ ...editor, parentId: event.target.value })
                        }
                      >
                        <option value="">Sem unidade superior</option>
                        {data.units
                          .filter(
                            (item) =>
                              item.id !== unit.id &&
                              item.canManage &&
                              item.active,
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </FormField>
                    <p className="text-sm text-[var(--text-muted)]">
                      A alteração não transfere pessoas. Uma unidade não pode
                      ficar subordinada a uma descendente.
                    </p>
                    {formActions}
                  </fieldset>
                </form>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-bold">Quadro de cargos</h3>
                {unit.canManage && (
                  <Button
                    className="min-h-11"
                    disabled={blocked || !unit.active}
                    onClick={() =>
                      edit({
                        kind: "position",
                        initial: null,
                        input: {
                          unitId: unit.id,
                          code: "",
                          title: "",
                          plannedCount: 0,
                          active: true,
                        },
                        confirmed: false,
                      })
                    }
                  >
                    Novo cargo
                  </Button>
                )}
              </div>
              {editor?.kind === "position" && (
                <form
                  onSubmit={save}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
                >
                  <fieldset disabled={saving} className="space-y-4">
                    <legend className="mb-4 font-bold">
                      {editor.initial ? "Editar cargo" : "Cadastrar cargo"}
                    </legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        label="Código do cargo"
                        htmlFor="position-code"
                      >
                        <Input
                          id="position-code"
                          required
                          maxLength={30}
                          value={editor.input.code}
                          onChange={(event) =>
                            setEditor({
                              ...editor,
                              input: {
                                ...editor.input,
                                code: event.target.value,
                              },
                            })
                          }
                        />
                      </FormField>
                      <FormField label="Nome do cargo" htmlFor="position-title">
                        <Input
                          id="position-title"
                          required
                          minLength={2}
                          maxLength={160}
                          value={editor.input.title}
                          onChange={(event) =>
                            setEditor({
                              ...editor,
                              input: {
                                ...editor.input,
                                title: event.target.value,
                              },
                            })
                          }
                        />
                      </FormField>
                      <FormField
                        label="Quantidade prevista"
                        htmlFor="position-count"
                      >
                        <Input
                          id="position-count"
                          type="number"
                          required
                          min={0}
                          max={2147483647}
                          step={1}
                          value={editor.input.plannedCount}
                          onChange={(event) =>
                            setEditor({
                              ...editor,
                              confirmed: false,
                              input: {
                                ...editor.input,
                                plannedCount: event.target.valueAsNumber,
                              },
                            })
                          }
                        />
                      </FormField>
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={editor.input.active}
                          onChange={(event) =>
                            setEditor({
                              ...editor,
                              input: {
                                ...editor.input,
                                active: event.target.checked,
                              },
                            })
                          }
                        />
                        Cargo ativo
                      </label>
                    </div>
                    {excess > 0 && (
                      <div className="space-y-2 text-sm">
                        <p>
                          {excess}{" "}
                          {excess === 1 ? "vínculo ficará" : "vínculos ficarão"}{" "}
                          acima da quantidade prevista. Nenhum vínculo será
                          excluído.
                        </p>
                        <label className="flex min-h-11 items-center gap-3">
                          <input
                            type="checkbox"
                            required
                            checked={editor.confirmed}
                            onChange={(event) =>
                              setEditor({
                                ...editor,
                                confirmed: event.target.checked,
                              })
                            }
                          />
                          Confirmo a redução sem excluir vínculos
                        </label>
                      </div>
                    )}
                    <p className="text-sm text-[var(--text-muted)]">
                      Um cargo ocupado não pode ser inativado. O cargo informado
                      no cadastro de cada pessoa será preservado.
                    </p>
                    {formActions}
                  </fieldset>
                </form>
              )}
              {unit.positions.length ? (
                <Table aria-label="Cargos da unidade">
                  <thead>
                    <TableRow>
                      {[
                        "Código",
                        "Cargo",
                        "Previstos",
                        "Ocupados",
                        "Vagas",
                        "Estado",
                        "Ações",
                      ].map((label) => (
                        <TableHead key={label} scope="col">
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </thead>
                  <tbody>
                    {unit.positions.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.code}</TableCell>
                        <TableCell>{job.title}</TableCell>
                        <TableCell>{job.plannedCount}</TableCell>
                        <TableCell>{job.occupiedCount}</TableCell>
                        <TableCell>{vacancies(job.vacancies)}</TableCell>
                        <TableCell>
                          <Badge variant={job.active ? "success" : "neutral"}>
                            {job.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {unit.canManage ? (
                            <Button
                              className="min-h-11"
                              variant="secondary"
                              disabled={blocked}
                              onClick={() =>
                                edit({
                                  kind: "position",
                                  initial: job,
                                  input: {
                                    unitId: job.unitId,
                                    code: job.code,
                                    title: job.title,
                                    plannedCount: job.plannedCount,
                                    active: job.active,
                                  },
                                  confirmed: false,
                                })
                              }
                            >
                              Editar cargo
                            </Button>
                          ) : (
                            "Somente consulta"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Nenhum cargo cadastrado nesta unidade.
                </p>
              )}
              <h3 className="pt-3 font-bold">Pessoas e associações</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Associe o vínculo a um cargo do quadro, sem alterar o cargo
                informado no cadastro.
              </p>
              {unit.employments.length ? (
                <Table aria-label="Pessoas da unidade">
                  <thead>
                    <TableRow>
                      {["Pessoa", "Cargo informado", "Cargo do quadro"].map(
                        (label) => (
                          <TableHead key={label} scope="col">
                            {label}
                          </TableHead>
                        ),
                      )}
                    </TableRow>
                  </thead>
                  <tbody>
                    {unit.employments.map((member) => {
                      const editing =
                        editor?.kind === "assignment" &&
                        editor.member.id === member.id;
                      return (
                        <TableRow key={member.id}>
                          <TableCell>{member.name}</TableCell>
                          <TableCell>
                            {member.jobTitle || "Não informado"}
                          </TableCell>
                          <TableCell>
                            {unit.canManage ? (
                              <form
                                onSubmit={save}
                                className="min-w-56 space-y-2"
                              >
                                <select
                                  aria-label="Cargo do quadro"
                                  className={selectClass}
                                  disabled={
                                    saving ||
                                    loading ||
                                    (Boolean(editor) && !editing)
                                  }
                                  value={
                                    editing
                                      ? editor.positionId
                                      : (member.positionId ?? "")
                                  }
                                  onChange={(event) =>
                                    edit({
                                      kind: "assignment",
                                      member,
                                      positionId: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">Sem associação</option>
                                  {unit.positions
                                    .filter(
                                      (job) =>
                                        job.active ||
                                        job.id === member.positionId ||
                                        (editing &&
                                          job.id === editor.positionId),
                                    )
                                    .map((job) => (
                                      <option
                                        key={job.id}
                                        value={job.id}
                                        disabled={!job.active}
                                      >
                                        {job.code} — {job.title}
                                      </option>
                                    ))}
                                </select>
                                {editing && referenceUpdated && (
                                  <p className="text-sm">
                                    Associação atual:{" "}
                                    {unit.positions.find(
                                      (job) => job.id === member.positionId,
                                    )?.title ?? "Sem associação"}
                                    .
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    className="min-h-11"
                                    type="submit"
                                    variant="secondary"
                                    disabled={!editing || saving || loading}
                                  >
                                    Salvar associação
                                  </Button>
                                  {editing && (
                                    <Button
                                      className="min-h-11"
                                      type="button"
                                      variant="quiet"
                                      disabled={saving}
                                      onClick={close}
                                    >
                                      Cancelar
                                    </Button>
                                  )}
                                </div>
                              </form>
                            ) : (
                              (unit.positions.find(
                                (job) => job.id === member.positionId,
                              )?.title ?? "Sem associação")
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </tbody>
                </Table>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Nenhuma pessoa com vínculo ativo nesta unidade.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
