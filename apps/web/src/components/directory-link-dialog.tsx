import type {
  AccountCandidate,
  AdminUser,
  DirectoryPreview,
} from "@cge/contracts";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  FormField,
  Input,
  SearchableSelect,
} from "@cge/ui";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, json } from "../lib/api";

export function DirectoryLinkDialog({
  account,
  onClose,
  onLinked,
}: {
  account: AdminUser | null;
  onClose: () => void;
  onLinked: () => Promise<void>;
}) {
  const [identifier, setIdentifier] = useState("");
  const [preview, setPreview] = useState<DirectoryPreview | null>(null);
  const [people, setPeople] = useState<AccountCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (account) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void api<{ people: AccountCandidate[] }>(
        `/api/admin/people?pageSize=20&query=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
        .then((result) => setPeople(result.people))
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof ApiError
                ? cause.message
                : "Não foi possível buscar pessoas.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [account, query]);

  async function lookup() {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(
        await api<DirectoryPreview>("/api/admin/directory/lookup", {
          method: "POST",
          body: json({ identifier }),
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível consultar o AD.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview?.eligible) return;
    const personId =
      account?.person.id ??
      String(new FormData(event.currentTarget).get("directoryPerson"));
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/directory/link", {
        method: "POST",
        body: json({ identifier, expectedGuid: preview.guid, personId }),
      });
      await onLinked();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível vincular a conta.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        title="Vincular acesso corporativo"
        description="Consulte a identidade no AD e confira a pessoa antes de confirmar o vínculo."
      >
        <form className="space-y-4" onSubmit={link}>
          {error ? (
            <Alert title="Revise o vínculo" tone="danger">
              {error}
            </Alert>
          ) : null}
          {account ? (
            <p>
              Pessoa: <strong>{account.person.displayName}</strong>
            </p>
          ) : (
            <FormField
              htmlFor="directoryPerson"
              label="Pessoa cadastrada"
              hint="Somente pessoas sem conta de acesso. Cadastre a pessoa no RH primeiro."
            >
              <SearchableSelect
                id="directoryPerson"
                name="directoryPerson"
                required
                disabled={busy}
                searching={searching}
                onSearchChange={setQuery}
                options={people.map((person) => ({
                  value: person.id,
                  label: person.displayName,
                  keywords: [person.unitName ?? ""],
                }))}
                placeholder="Pesquise a pessoa"
              />
            </FormField>
          )}
          <FormField
            htmlFor="directoryIdentifier"
            label="Usuário do AD"
            hint="Informe o nome de usuário ou UPN corporativo."
          >
            <Input
              id="directoryIdentifier"
              value={identifier}
              disabled={busy}
              autoComplete="off"
              required
              maxLength={254}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setPreview(null);
              }}
            />
          </FormField>
          <Button
            type="button"
            disabled={busy || !identifier.trim()}
            onClick={() => void lookup()}
          >
            Consultar AD
          </Button>
          {preview ? (
            <Alert
              title={preview.displayName}
              tone={preview.eligible ? "neutral" : "danger"}
            >
              <p>{preview.upn}</p>
              <p>{preview.email ?? "Sem e-mail cadastrado"}</p>
              {!preview.eligible ? (
                <p>
                  A conta não está apta para acesso. Solicite a revisão pela TI.
                </p>
              ) : null}
            </Alert>
          ) : null}
          {preview?.eligible ? (
            <>
              <p className="text-sm text-[var(--text-muted)]">
                {account
                  ? "A senha local deixará de funcionar e as sessões abertas serão encerradas. Os acessos atuais serão preservados."
                  : "O vínculo não concede permissões. Após salvar, atribua os acessos na administração."}
              </p>
              <Button type="submit" disabled={busy}>
                Confirmar vínculo com AD
              </Button>
            </>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
