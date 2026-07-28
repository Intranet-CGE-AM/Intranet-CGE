import { Alert, Button, FormField, Input } from "@cge/ui";
import { LockKey } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { useAuth } from "../auth";
import { AuthLayout } from "../components/auth-layout";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    from?: string;
    passwordChanged?: boolean;
  } | null;
  const [passwordChanged] = useState(
    () =>
      Boolean(state?.passwordChanged) ||
      window.sessionStorage.getItem("passwordChanged") === "true",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (passwordChanged) {
      window.sessionStorage.removeItem("passwordChanged");
    }
  }, [passwordChanged]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      await login({
        email: String(data.get("email")),
        password: String(data.get("password")),
      });
      navigate(state?.from ?? "/", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Acesso institucional"
      title="Bem-vindo de volta"
      description="Entre com as credenciais fornecidas pela administração da intranet."
    >
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
        <LockKey aria-hidden="true" className="text-[var(--brand)]" size={16} />
        Autenticação local protegida
      </div>
      {passwordChanged ? (
        <Alert title="Senha alterada" className="mb-5" tone="success">
          Entre novamente usando a nova senha.
        </Alert>
      ) : null}
      {error ? (
        <Alert title="Não foi possível entrar" className="mb-5" tone="danger">
          {error}
        </Alert>
      ) : null}
      <form className="space-y-4" onSubmit={submit}>
        <FormField htmlFor="email" label="E-mail institucional">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            spellCheck={false}
            required
          />
        </FormField>
        <FormField htmlFor="password" label="Senha">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </FormField>
        <Button className="min-h-12 w-full" disabled={submitting} type="submit">
          {submitting ? "Entrando…" : "Entrar na intranet"}
        </Button>
      </form>
    </AuthLayout>
  );
}
