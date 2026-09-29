import type { AuditDocumentDetail } from "@cge/contracts";
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  FormField,
  Input,
  Skeleton,
  Textarea,
} from "@cge/ui";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowLeft,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Table as TableIcon,
  TextAlignCenter,
  TextAlignJustify,
  TextAlignLeft,
  TextAlignRight,
  TextB,
  TextItalic,
  TextUnderline,
  type Icon,
} from "@phosphor-icons/react";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router";

import { PageHeader } from "../components/page-header";
import { api, ApiError, json } from "../lib/api";
import { docxToHtml, DOCX_MIME, editorToDocx } from "../lib/docx-html";
import {
  AUDIT_EYEBROW,
  errorMessage,
  fileUrl,
  latestFile,
} from "./audit-documents";

const NOTICE_KEY = "audit-editor:notice-seen";
// Browser storage can be missing or blocked; drafts are a convenience only.
const storage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// One draft per document; it remembers which version it was made from.
const draftKey = (documentId: string) => `audit-editor:draft:${documentId}`;
type Draft = { fileId: string; number: number; html: string };
function readDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(storage.get(key) ?? "null") as Draft | null;
    return value && typeof value.html === "string" ? value : null;
  } catch {
    return null;
  }
}

type Loaded = {
  document: AuditDocumentDetail;
  fileId: string;
  fileName: string;
  number: number;
  html: string;
};

export function AuditDocumentEditorPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoaded(null);
    setError("");
    (async () => {
      const document = await api<AuditDocumentDetail>(
        `/api/audit-documents/${id}`,
      );
      const latest = latestFile(document.files);
      const editable =
        document.allowedActions.includes("edit_version") ||
        document.allowedActions.includes("submit_version");
      if (!latest || latest.kind !== "docx" || !editable)
        throw new Error(
          "Este documento não pode ser editado no navegador agora. Só a versão atual em Word (.docx) pode ser editada, por quem pode enviar nova versão.",
        );
      const response = await fetch(fileUrl(id, latest.id, "inline"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Não foi possível abrir o arquivo.");
      const html = await docxToHtml(await response.arrayBuffer());
      if (active)
        setLoaded({
          document,
          fileId: latest.id,
          fileName: latest.fileName,
          number: latest.number,
          html,
        });
    })().catch((cause: unknown) => {
      if (active)
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível abrir o editor.",
        );
    });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  if (!loaded)
    return (
      <div className="page-enter space-y-4">
        <Button
          className="-ml-2"
          onClick={() => void navigate(`/controle-interno/documentos/${id}`)}
          size="sm"
          variant="quiet"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Voltar ao documento
        </Button>
        {error ? (
          <Alert title="Editor indisponível" tone="danger">
            <p>{error}</p>
            <Button
              className="mt-3"
              onClick={() => setAttempt((value) => value + 1)}
              size="sm"
              variant="secondary"
            >
              Tentar novamente
            </Button>
          </Alert>
        ) : (
          <div
            aria-label="Abrindo documento no editor"
            className="space-y-4"
            role="status"
          >
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}
      </div>
    );

  return (
    <EditorScreen
      key={loaded.fileId}
      loaded={loaded}
      onReload={() => setAttempt((value) => value + 1)}
    />
  );
}

function EditorScreen({
  loaded,
  onReload,
}: {
  loaded: Loaded;
  onReload: () => void;
}) {
  const navigate = useNavigate();
  const { document } = loaded;
  const key = draftKey(document.id);
  const saveDraft = (html: string) =>
    storage.set(
      key,
      JSON.stringify({ fileId: loaded.fileId, number: loaded.number, html }),
    );
  const detailPath = `/controle-interno/documentos/${document.id}`;
  const [draft, setDraft] = useState(() => readDraft(key));
  const [dirty, setDirty] = useState(false);
  const [noticeSeen, setNoticeSeen] = useState(
    () => storage.get(NOTICE_KEY) === "1",
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          protocols: ["http", "https", "mailto"],
        },
      }),
      Image.configure({ allowBase64: true }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: loaded.html,
    editorProps: {
      attributes: {
        "aria-label": "Conteúdo do documento",
        "aria-multiline": "true",
        role: "textbox",
        class:
          "min-h-[60vh] px-5 py-6 text-[15px] leading-7 text-[var(--text)] focus:outline-none sm:px-10",
      },
    },
    onUpdate: () => setDirty(true),
  });

  // Draft autosave, one second after the last keystroke.
  useEffect(() => {
    if (!editor || !dirty) return;
    const timer = window.setTimeout(() => saveDraft(editor.getHTML()), 1000);
    return () => window.clearTimeout(timer);
  });

  // Leaving with unsaved edits: the tab close asks the browser; in-app links
  // ask here (the app uses BrowserRouter, which has no navigation blocker).
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0)
        return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.closest(".ProseMirror")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || anchor.target) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.document.removeEventListener("click", click, true);
    };
  }, []);

  const leave = useCallback(
    (to: string) => {
      if (dirtyRef.current) setLeaveTo(to);
      else void navigate(to);
    },
    [navigate],
  );

  return (
    <div className="page-enter space-y-4">
      <Button
        className="-ml-2"
        onClick={() => leave(detailPath)}
        size="sm"
        variant="quiet"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Voltar ao documento
      </Button>
      <PageHeader
        actions={
          <>
            <Button onClick={() => leave(detailPath)} variant="secondary">
              Cancelar
            </Button>
            <Button disabled={!editor} onClick={() => setSaveOpen(true)}>
              Salvar nova versão
            </Button>
          </>
        }
        description={`Editando a versão ${loaded.number} (${loaded.fileName}). Ao salvar, o texto vira uma nova versão em Word.`}
        eyebrow={AUDIT_EYEBROW}
        title={document.title}
      />

      {!noticeSeen ? (
        <Alert title="A edição no navegador pode alterar a formatação do Word">
          <p>
            Cabeçalhos, rodapés, comentários, caixas de texto e tabelas
            complexas podem se perder. Depois de salvar, confira a nova versão
            no visualizador.
          </p>
          <Button
            className="mt-3"
            onClick={() => {
              storage.set(NOTICE_KEY, "1");
              setNoticeSeen(true);
            }}
            size="sm"
            variant="secondary"
          >
            Entendi
          </Button>
        </Alert>
      ) : null}

      {draft && draft.html !== loaded.html ? (
        <Alert title="Há um rascunho não salvo" tone="neutral">
          <p>
            {draft.fileId === loaded.fileId
              ? "O navegador guardou edições desta versão que ainda não foram salvas."
              : `O rascunho foi feito sobre a versão ${draft.number}, e a versão atual é a ${loaded.number}. Recuperar substitui o texto atual pelo rascunho.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                editor?.commands.setContent(draft.html, { emitUpdate: true });
                setDraft(null);
              }}
              size="sm"
              variant="secondary"
            >
              Recuperar rascunho
            </Button>
            <Button
              onClick={() => {
                storage.remove(key);
                setDraft(null);
              }}
              size="sm"
              variant="quiet"
            >
              Descartar
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        {editor ? <Toolbar editor={editor} /> : null}
        <div className="bg-[var(--surface-subtle)] p-2 sm:p-6">
          <div className="mx-auto max-w-[52rem] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] [&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline-[var(--focus)] [&_a]:text-[var(--brand)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-4 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_img]:inline-block [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--border)] [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:border-[var(--border)] [&_th]:bg-[var(--surface-subtle)] [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6 overflow-x-auto">
            <EditorContent editor={editor} />
          </div>
        </div>
      </Card>

      {editor ? (
        <SaveDialog
          editor={editor}
          loaded={loaded}
          onClose={() => setSaveOpen(false)}
          onReload={onReload}
          onSaved={() => {
            storage.remove(key);
            dirtyRef.current = false;
            setDirty(false);
            void navigate(detailPath);
          }}
          open={saveOpen}
        />
      ) : null}

      <Dialog
        onOpenChange={(open) => !open && setLeaveTo(null)}
        open={leaveTo !== null}
      >
        <DialogContent
          description="As edições ficam guardadas como rascunho neste navegador, mas não viram uma nova versão."
          title="Sair sem salvar?"
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setLeaveTo(null)} variant="secondary">
              Continuar editando
            </Button>
            <Button
              onClick={() => {
                if (editor) saveDraft(editor.getHTML());
                dirtyRef.current = false;
                const to = leaveTo ?? detailPath;
                setLeaveTo(null);
                void navigate(to);
              }}
              variant="danger"
            >
              Sair sem salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      link: editor.isActive("link"),
      block: editor.isActive("heading", { level: 1 })
        ? "h1"
        : editor.isActive("heading", { level: 2 })
          ? "h2"
          : editor.isActive("heading", { level: 3 })
            ? "h3"
            : "p",
      align: (["left", "center", "right", "justify"] as const).find((value) =>
        editor.isActive({ textAlign: value }),
      ),
      undo: editor.can().undo(),
      redo: editor.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const tool = (
    label: string,
    icon: Icon,
    run: () => void,
    pressed?: boolean,
    disabled?: boolean,
  ) => {
    const ToolIcon = icon;
    return (
      <Button
        aria-label={label}
        aria-pressed={pressed}
        className={pressed ? "bg-[var(--brand-soft)] text-[var(--brand)]" : ""}
        disabled={disabled}
        key={label}
        onClick={run}
        size="icon"
        title={label}
        type="button"
        variant="quiet"
      >
        <ToolIcon aria-hidden="true" size={18} />
      </Button>
    );
  };
  const separator = (key: string) => (
    <span
      aria-hidden="true"
      className="mx-1 h-6 w-px self-center bg-[var(--border)]"
      key={key}
    />
  );
  const blocks = [
    ["p", "Texto"],
    ["h1", "Título 1"],
    ["h2", "Título 2"],
    ["h3", "Título 3"],
  ] as const;

  return (
    <div
      aria-label="Formatação"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2"
      role="toolbar"
    >
      {blocks.map(([value, label]) => (
        <Button
          aria-pressed={state.block === value}
          className={
            state.block === value
              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
              : ""
          }
          key={value}
          onClick={() =>
            value === "p"
              ? chain().setParagraph().run()
              : chain()
                  .toggleHeading({ level: Number(value[1]) as 1 | 2 | 3 })
                  .run()
          }
          size="sm"
          type="button"
          variant="quiet"
        >
          {label}
        </Button>
      ))}
      {separator("s1")}
      {tool("Negrito", TextB, () => chain().toggleBold().run(), state.bold)}
      {tool(
        "Itálico",
        TextItalic,
        () => chain().toggleItalic().run(),
        state.italic,
      )}
      {tool(
        "Sublinhado",
        TextUnderline,
        () => chain().toggleUnderline().run(),
        state.underline,
      )}
      {tool("Link", LinkSimple, () => setLinkOpen(true), state.link)}
      {separator("s2")}
      {tool(
        "Lista com marcadores",
        ListBullets,
        () => chain().toggleBulletList().run(),
        state.bullet,
      )}
      {tool(
        "Lista numerada",
        ListNumbers,
        () => chain().toggleOrderedList().run(),
        state.ordered,
      )}
      {separator("s3")}
      {(
        [
          ["left", "Alinhar à esquerda", TextAlignLeft],
          ["center", "Centralizar", TextAlignCenter],
          ["right", "Alinhar à direita", TextAlignRight],
          ["justify", "Justificar", TextAlignJustify],
        ] as const
      ).map(([value, label, icon]) =>
        tool(
          label,
          icon,
          () => chain().setTextAlign(value).run(),
          state.align === value,
        ),
      )}
      {separator("s4")}
      {tool("Inserir tabela", TableIcon, () =>
        chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      )}
      {tool(
        "Desfazer",
        ArrowCounterClockwise,
        () => chain().undo().run(),
        undefined,
        !state.undo,
      )}
      {tool(
        "Refazer",
        ArrowClockwise,
        () => chain().redo().run(),
        undefined,
        !state.redo,
      )}
      <LinkDialog
        editor={editor}
        onClose={() => setLinkOpen(false)}
        open={linkOpen}
      />
    </div>
  );
}

function LinkDialog({
  editor,
  onClose,
  open,
}: {
  editor: Editor;
  onClose: () => void;
  open: boolean;
}) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const href = String(
      new FormData(event.currentTarget).get("href") ?? "",
    ).trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) {
      chain.unsetLink().run();
      onClose();
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      setError("Use um endereço que comece com https://, http:// ou mailto:.");
      return;
    }
    chain.setLink({ href }).run();
    onClose();
  }
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setError("");
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent
        description="Deixe em branco para remover o link do texto selecionado."
        title="Link"
      >
        <form className="space-y-4" onSubmit={submit}>
          <FormField error={error} htmlFor="editorLink" label="Endereço">
            <Input
              aria-invalid={Boolean(error)}
              defaultValue={String(editor.getAttributes("link").href ?? "")}
              id="editorLink"
              name="href"
              placeholder="https://"
              type="text"
            />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onClose} type="button" variant="secondary">
              Cancelar
            </Button>
            <Button type="submit">Aplicar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveDialog({
  editor,
  loaded,
  onClose,
  onReload,
  onSaved,
  open,
}: {
  editor: Editor;
  loaded: Loaded;
  onClose: () => void;
  onReload: () => void;
  onSaved: () => void;
  open: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; stale: boolean }>();
  const { document } = loaded;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    setBusy(true);
    setError(undefined);
    try {
      const blob = await editorToDocx(editor.getJSON(), document.title);
      const name = loaded.fileName.replace(/(\.docx)?$/i, "") + ".docx";
      const body = new FormData();
      body.append(
        "metadata",
        json({
          version: document.version,
          note: note.trim() || null,
          source: "editor",
        }),
      );
      body.append("file", new File([blob], name, { type: DOCX_MIME }));
      await api(`/api/audit-documents/${document.id}/files`, {
        body,
        method: "POST",
      });
      onSaved();
    } catch (cause) {
      setError({
        message:
          cause instanceof ApiError && cause.status === 409
            ? "Outra pessoa salvou ou mudou este documento enquanto você editava. Suas edições estão guardadas como rascunho neste navegador. Recarregue para editar a partir da versão mais recente."
            : errorMessage(cause, "Não foi possível salvar a nova versão."),
        stale: cause instanceof ApiError && cause.status === 409,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next && !busy) {
          setError(undefined);
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent
        description={
          document.status === "correction_requested"
            ? "A nova versão volta para revisão da Subcontroladoria."
            : "A nova versão fica registrada no histórico como edição da Subcontroladoria."
        }
        title="Salvar nova versão"
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {error ? (
            <Alert title="Versão não salva" tone="danger">
              <p>{error.message}</p>
              {error.stale ? (
                <Button
                  className="mt-3"
                  onClick={() => {
                    storage.set(
                      draftKey(document.id),
                      JSON.stringify({
                        fileId: loaded.fileId,
                        number: loaded.number,
                        html: editor.getHTML(),
                      }),
                    );
                    onClose();
                    onReload();
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Recarregar documento
                </Button>
              ) : null}
            </Alert>
          ) : null}
          <FormField htmlFor="editorNote" label="Observação (opcional)">
            <Textarea id="editorNote" maxLength={2000} name="note" />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={busy}
              onClick={onClose}
              type="button"
              variant="secondary"
            >
              Voltar
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? "Salvando…" : "Salvar versão"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
