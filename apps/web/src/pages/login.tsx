import { Alert, Button, FormField, Input } from "@cge/ui";
import { LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { AuthLayout } from "../components/auth-layout";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/", { replace: true });
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
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[var(--brand-soft)] p-3 text-sm font-semibold text-[var(--brand-strong)]">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-[var(--brand)]">
          <LockKeyhole aria-hidden="true" size={17} />
        </span>
        Acesso local protegido
      </div>
      {error ? (
        <Alert title="Não foi possível entrar" className="mb-5">
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
