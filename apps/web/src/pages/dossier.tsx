import type { Dossier } from "@cge/contracts";
import { Alert, Avatar, Button } from "@cge/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../lib/api";
import { DocumentsSection } from "./documents";
import { EmploymentHistorySection } from "./employment-history";
import { TrainingSection } from "./training";

// Consulta somente leitura, na linguagem visual já usada em Minha conta.
export function DossierPage() {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    api<Dossier>("/api/me/dossier")
      .then((value) => {
        if (active) setDossier(value);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível carregar seu dossiê. Tente novamente.");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const date = (value?: string | null) =>
    value ? value.split("-").reverse().join("/") : null;
  const employment = dossier?.employment;
  return (
    <div className="max-w-4xl space-y-8 pb-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
          Meu dossiê
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Confira seus dados pessoais e seu vínculo com a CGE.
        </p>
      </header>
      {error ? (
        <Alert title="Não foi possível carregar" tone="danger">
          {error}
          <Button onClick={() => setAttempt(attempt + 1)}>
            Tentar novamente
          </Button>
        </Alert>
      ) : !dossier ? (
        <p role="status">Carregando seu dossiê…</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={dossier.fullName} src={dossier.avatarUrl} />
            <Link
              className="text-sm font-semibold underline underline-offset-4"
              to="/conta"
            >
              Gerenciar minha foto e senha
            </Link>
          </div>
          {(
            [
              [
                "Dados pessoais",
                [
                  ["Nome", dossier.fullName],
                  ["Nome preferido", dossier.preferredName],
                  ["Nascimento", date(dossier.birthDate)],
                ],
              ],
              [
                "Vínculo funcional",
                [
                  ["Matrícula", employment?.employeeNumber],
                  ["Cargo", employment?.jobTitle],
                  ["Categoria", employment?.categoryName],
                  ["Unidade", employment?.unitName],
                  ["Início do vínculo", date(employment?.startDate)],
                  ["Chefia direta", dossier.supervisorName],
                ],
              ],
            ] as const
          ).map(([title, fields]) => (
            <section key={title} aria-label={title}>
              <h2 className="text-lg font-bold">{title}</h2>
              {title === "Vínculo funcional" && !employment ? (
                <p className="mt-3 text-sm">
                  Você não possui vínculo ativo. Procure a Gestão de Pessoas
                  para revisar seu cadastro.
                </p>
              ) : (
                <dl className="mt-4 grid gap-6 border-y border-[var(--border)] py-6 sm:grid-cols-2">
                  {fields.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-sm text-[var(--text-muted)]">
                        {label}
                      </dt>
                      <dd className="mt-1 break-words font-semibold">
                        {value || "Não informado"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
          <DocumentsSection />
          <EmploymentHistorySection />
          <TrainingSection />
          <p className="text-sm text-[var(--text-muted)]">
            Encontrou alguma informação incorreta? Procure a Gestão de Pessoas.
            Os dados desta página são somente leitura.
          </p>
        </>
      )}
    </div>
  );
}
