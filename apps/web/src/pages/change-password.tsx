import { Alert, Button, FormField, Input } from "@cge/ui";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAuth } from "../auth";
import { AuthLayout } from "../components/auth-layout";
import { ApiError } from "../lib/api";

export function ChangePasswordPage() {
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.account.mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmation"))) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await changePassword({
        currentPassword: String(data.get("currentPassword")),
        newPassword,
      });
      navigate("/login", {
        replace: true,
        state: { passwordChanged: true },
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Primeiro acesso"
      title="Proteja sua conta"
      description="Substitua a senha temporária antes de acessar os módulos da intranet."
    >
      {error ? (
        <Alert title="Revise os dados" className="mb-5" tone="danger">
          {error}
        </Alert>
      ) : null}
      <form className="space-y-4" onSubmit={submit}>
        <FormField htmlFor="currentPassword" label="Senha temporária">
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </FormField>
        <FormField
          htmlFor="newPassword"
          label="Nova senha"
          hint="Use pelo menos 12 caracteres."
        >
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={12}
            autoComplete="new-password"
            required
          />
        </FormField>
        <FormField htmlFor="confirmation" label="Confirme a nova senha">
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            minLength={12}
            autoComplete="new-password"
            required
          />
        </FormField>
        <Button className="min-h-12 w-full" disabled={submitting} type="submit">
          {submitting ? "Alterando…" : "Alterar senha"}
        </Button>
      </form>
    </AuthLayout>
  );
}
