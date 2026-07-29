import {
  Alert,
  AvatarPicker,
  Button,
  ConfirmDialog,
  FormField,
  Input,
  Toast,
} from "@cge/ui";
import { Key, Trash } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../auth";
import { api, ApiError } from "../lib/api";

export function AccountPage() {
  const { changePassword, refresh, user } = useAuth();
  const navigate = useNavigate();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarToast, setAvatarToast] = useState<{
    description?: string;
    title: string;
    tone: "success" | "danger";
  } | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  if (!user) return null;
  const currentUser = user;

  async function uploadAvatar(file: File | null) {
    if (!file) {
      setAvatarFile(null);
      return;
    }
    setAvatarFile(file);
    const body = new FormData();
    body.append("avatar", file);
    try {
      setAvatarBusy(true);
      setAvatarToast(null);
      await api(`/api/people/${currentUser.person.id}/avatar`, {
        method: "PUT",
        body,
      });
      await refresh();
      setAvatarFile(null);
      setAvatarToast({
        title: "Foto de perfil atualizada",
        tone: "success",
      });
    } catch (cause) {
      setAvatarToast({
        description:
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível atualizar a foto.",
        title: "Não foi possível salvar",
        tone: "danger",
      });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    try {
      setAvatarBusy(true);
      setAvatarToast(null);
      await api(`/api/people/${currentUser.person.id}/avatar`, {
        method: "DELETE",
      });
      await refresh();
      setAvatarFile(null);
      setAvatarToast({
        title: "Foto de perfil removida",
        tone: "success",
      });
    } catch (cause) {
      setAvatarToast({
        description:
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível remover a foto.",
        title: "Não foi possível remover",
        tone: "danger",
      });
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

        <div className="max-w-2xl">
          <AvatarPicker
            description={currentUser.account.email}
            disabled={avatarBusy}
            file={avatarFile}
            id="accountAvatar"
            name={currentUser.person.displayName}
            onFileChange={(file) => void uploadAvatar(file)}
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

          <div className="mt-5 flex flex-wrap gap-2">
            {avatarBusy ? (
              <p
                className="py-2 text-sm font-semibold text-[var(--text-muted)]"
                role="status"
              >
                Salvando foto…
              </p>
            ) : null}
            {currentUser.person.avatarUrl ? (
              <ConfirmDialog
                confirmLabel="Remover foto"
                description="Sua foto será removida da intranet. Você continuará sendo identificado pelas iniciais do seu nome."
                onConfirm={removeAvatar}
                title="Remover sua foto?"
              >
                <Button disabled={avatarBusy} type="button" variant="quiet">
                  <Trash aria-hidden="true" size={18} />
                  Remover foto
                </Button>
              </ConfirmDialog>
            ) : null}
          </div>
        </div>
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
      {avatarToast ? (
        <Toast
          description={avatarToast.description}
          onDismiss={() => setAvatarToast(null)}
          title={avatarToast.title}
          tone={avatarToast.tone}
        />
      ) : null}
    </div>
  );
}
