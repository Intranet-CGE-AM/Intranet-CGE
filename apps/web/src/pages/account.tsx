import { Alert, AvatarPicker, Button, FormField, Input } from "@cge/ui";
import { Camera, Key, Trash } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../auth";
import { api, ApiError } from "../lib/api";

export function AccountPage() {
  const { changePassword, refresh, user } = useAuth();
  const navigate = useNavigate();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  if (!user) return null;
  const currentUser = user;

  async function uploadAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!avatarFile) return;
    const form = event.currentTarget;
    const body = new FormData();
    body.append("avatar", avatarFile);
    try {
      setAvatarBusy(true);
      setAvatarError("");
      setAvatarMessage("");
      await api(`/api/people/${currentUser.person.id}/avatar`, {
        method: "PUT",
        body,
      });
      await refresh();
      form.reset();
      setAvatarFile(null);
      setAvatarMessage("Foto de perfil atualizada.");
    } catch (cause) {
      setAvatarError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível atualizar a foto.",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (!window.confirm("Remover sua foto de perfil?")) return;
    try {
      setAvatarBusy(true);
      setAvatarError("");
      setAvatarMessage("");
      await api(`/api/people/${currentUser.person.id}/avatar`, {
        method: "DELETE",
      });
      await refresh();
      setAvatarMessage("Foto de perfil removida.");
    } catch (cause) {
      setAvatarError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível remover a foto.",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmation"))) {
      setPasswordError("A confirmação não corresponde à nova senha.");
      return;
    }
    try {
      setPasswordBusy(true);
      setPasswordError("");
      await changePassword({
        currentPassword: String(data.get("currentPassword")),
        newPassword,
      });
      navigate("/login", {
        replace: true,
        state: { passwordChanged: true },
      });
    } catch (cause) {
      setPasswordError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-8 pb-8">
      <header className="border-b border-[var(--border)] pb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Preferências pessoais
        </p>
        <h1 className="mt-3 text-[34px] font-extrabold leading-none tracking-[-0.05em]">
          Minha conta
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
          Gerencie sua foto e a segurança do seu acesso. Dados funcionais e
          e-mail institucional são mantidos pela administração.
        </p>
      </header>

      <section
        aria-labelledby="profile-title"
        className="grid gap-6 border-b border-[var(--border)] pb-8 lg:grid-cols-[minmax(240px,0.42fr)_minmax(0,0.58fr)]"
      >
        <div>
          <h2
            className="text-lg font-extrabold tracking-[-0.025em]"
            id="profile-title"
          >
            Perfil
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
            Sua foto identifica você no diretório, aniversários e fluxos de
            trabalho.
          </p>
        </div>

        <form className="max-w-2xl" onSubmit={uploadAvatar}>
          <AvatarPicker
            description={currentUser.account.email}
            disabled={avatarBusy}
            file={avatarFile}
            id="accountAvatar"
            name={currentUser.person.displayName}
            onFileChange={setAvatarFile}
            src={currentUser.person.avatarUrl}
          />

          <dl className="mt-6 grid gap-x-6 gap-y-4 border-y border-[var(--border)] py-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-[var(--text-faint)]">
                Unidade
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {currentUser.employment?.unit.name ?? "Sem vínculo ativo"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-[var(--text-faint)]">
                Cargo
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {currentUser.employment?.jobTitle ?? "Não informado"}
              </dd>
            </div>
          </dl>

          {avatarError ? (
            <Alert
              className="mt-5"
              title="Não foi possível salvar"
              tone="danger"
            >
              {avatarError}
            </Alert>
          ) : null}
          {avatarMessage ? (
            <Alert className="mt-5" title="Perfil atualizado" tone="success">
              {avatarMessage}
            </Alert>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button disabled={!avatarFile || avatarBusy} type="submit">
              <Camera aria-hidden="true" size={18} />
              {avatarBusy ? "Salvando…" : "Salvar foto"}
            </Button>
            {currentUser.person.avatarUrl ? (
              <Button
                disabled={avatarBusy}
                onClick={() => void removeAvatar()}
                type="button"
                variant="quiet"
              >
                <Trash aria-hidden="true" size={18} />
                Remover foto
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section
        aria-labelledby="security-title"
        className="grid gap-6 lg:grid-cols-[minmax(240px,0.42fr)_minmax(0,0.58fr)]"
        id="seguranca"
      >
        <div>
          <h2
            className="flex items-center gap-2 text-lg font-extrabold tracking-[-0.025em]"
            id="security-title"
          >
            <Key aria-hidden="true" className="text-[var(--brand)]" size={20} />
            Segurança
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
            Alterar a senha encerra as sessões abertas. Você deverá entrar
            novamente.
          </p>
        </div>

        <form className="max-w-2xl space-y-4" onSubmit={updatePassword}>
          {passwordError ? (
            <Alert title="Revise os dados" tone="danger">
              {passwordError}
            </Alert>
          ) : null}
          <FormField htmlFor="currentPassword" label="Senha atual">
            <Input
              autoComplete="current-password"
              id="currentPassword"
              name="currentPassword"
              required
              type="password"
            />
          </FormField>
          <FormField
            htmlFor="newPassword"
            label="Nova senha"
            hint="Use pelo menos 12 caracteres."
          >
            <Input
              autoComplete="new-password"
              id="newPassword"
              minLength={12}
              name="newPassword"
              required
              type="password"
            />
          </FormField>
          <FormField htmlFor="confirmation" label="Confirme a nova senha">
            <Input
              autoComplete="new-password"
              id="confirmation"
              minLength={12}
              name="confirmation"
              required
              type="password"
            />
          </FormField>
          <Button disabled={passwordBusy} type="submit">
            {passwordBusy ? "Alterando…" : "Alterar senha"}
          </Button>
        </form>
      </section>
    </div>
  );
}
