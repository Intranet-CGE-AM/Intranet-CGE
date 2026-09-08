import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { RequireAuth } from "./auth";
import { AppShell } from "./components/app-shell";
import { RequireAccess } from "./components/require-access";
import { accessRules } from "./navigation";
import { ChangePasswordPage } from "./pages/change-password";
import { LoginPage } from "./pages/login";
import { NotificationsPage } from "./pages/notifications";
const ResourcesPage = lazy(() =>
  import("./pages/resources").then((module) => ({
    default: module.ResourcesPage,
  })),
);
const CommunicationsPage = lazy(() =>
  import("./pages/communications").then((module) => ({
    default: module.CommunicationsPage,
  })),
);
const OrganizationPage = lazy(() =>
  import("./pages/organization").then((module) => ({
    default: module.OrganizationPage,
  })),
);
const InboxPage = lazy(() =>
  import("./pages/inbox").then((module) => ({ default: module.InboxPage })),
);
const SubstitutionsPage = lazy(() =>
  import("./pages/substitutions").then((module) => ({
    default: module.SubstitutionsPage,
  })),
);
const ChecklistsPage = lazy(() =>
  import("./pages/checklists").then((module) => ({
    default: module.ChecklistsPage,
  })),
);
const MetricsPage = lazy(() =>
  import("./pages/metrics").then((module) => ({ default: module.MetricsPage })),
);
const TrainingPage = lazy(() =>
  import("./pages/training").then((module) => ({
    default: module.TrainingPage,
  })),
);
const AvailabilityPage = lazy(() =>
  import("./pages/availability").then((module) => ({
    default: module.AvailabilityPage,
  })),
);
const OccurrencesPage = lazy(() =>
  import("./pages/occurrences").then((module) => ({
    default: module.OccurrencesPage,
  })),
);
const EmploymentHistoryPage = lazy(() =>
  import("./pages/employment-history").then((module) => ({
    default: module.EmploymentHistoryPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("./pages/documents").then((module) => ({
    default: module.DocumentsPage,
  })),
);

const AccountPage = lazy(() =>
  import("./pages/account").then((module) => ({ default: module.AccountPage })),
);
const DossierPage = lazy(() =>
  import("./pages/dossier").then((module) => ({ default: module.DossierPage })),
);
const HrRequestsPage = lazy(() =>
  import("./pages/hr-requests").then((module) => ({
    default: module.HrRequestsPage,
  })),
);
const AdminPage = lazy(() =>
  import("./pages/admin").then((module) => ({ default: module.AdminPage })),
);
const AuditPage = lazy(() =>
  import("./pages/audit").then((module) => ({ default: module.AuditPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard").then((module) => ({
    default: module.DashboardPage,
  })),
);
const HubPage = lazy(() =>
  import("./pages/hub").then((module) => ({ default: module.HubPage })),
);
const PeoplePage = lazy(() =>
  import("./pages/people").then((module) => ({ default: module.PeoplePage })),
);
const UiKitPage = lazy(() =>
  import("./pages/ui-kit").then((module) => ({ default: module.UiKitPage })),
);
const VacationsPage = lazy(() =>
  import("./pages/vacations").then((module) => ({
    default: module.VacationsPage,
  })),
);

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="alterar-senha" element={<ChangePasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route
            path="biblioteca"
            element={
              <Suspense fallback={<PageFallback />}>
                <ResourcesPage />
              </Suspense>
            }
          />
          <Route
            path="comunicados"
            element={
              <Suspense fallback={<PageFallback />}>
                <CommunicationsPage />
              </Suspense>
            }
          />
          <Route
            path="rh/estrutura"
            element={
              <RequireAccess
                rule={{
                  anyOf: ["organization.read", "organization.manage_positions"],
                }}
              >
                <Suspense fallback={<PageFallback />}>
                  <OrganizationPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/substituicoes"
            element={
              <RequireAccess
                rule={{ anyOf: ["workflows.manage_substitutions"] }}
              >
                <Suspense fallback={<PageFallback />}>
                  <SubstitutionsPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/pendencias"
            element={
              <Suspense fallback={<PageFallback />}>
                <InboxPage />
              </Suspense>
            }
          />
          <Route
            path="rh/checklists"
            element={
              <Suspense fallback={<PageFallback />}>
                <ChecklistsPage />
              </Suspense>
            }
          />
          <Route
            path="rh/indicadores"
            element={
              <RequireAccess rule={accessRules.metrics}>
                <Suspense fallback={<PageFallback />}>
                  <MetricsPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <HubPage />
              </Suspense>
            }
          />
          <Route
            path="rh"
            element={
              <RequireAccess rule={accessRules.hr}>
                <Suspense fallback={<PageFallback />}>
                  <DashboardPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/colaboradores"
            element={
              <RequireAccess rule={accessRules.people}>
                <Suspense fallback={<PageFallback />}>
                  <PeoplePage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/ferias"
            element={
              <RequireAccess rule={accessRules.vacations}>
                <Suspense fallback={<PageFallback />}>
                  <VacationsPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/ocorrencias"
            element={
              <RequireAccess rule={accessRules.occurrences}>
                <Suspense fallback={<PageFallback />}>
                  <OccurrencesPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/disponibilidade"
            element={
              <RequireAccess rule={accessRules.availability}>
                <Suspense fallback={<PageFallback />}>
                  <AvailabilityPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="sistema/administracao"
            element={
              <RequireAccess rule={accessRules.administration}>
                <Suspense fallback={<PageFallback />}>
                  <AdminPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="sistema/auditoria"
            element={
              <RequireAccess rule={accessRules.audit}>
                <Suspense fallback={<PageFallback />}>
                  <AuditPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="conta"
            element={
              <Suspense fallback={<PageFallback />}>
                <AccountPage />
              </Suspense>
            }
          />
          <Route path="notificacoes" element={<NotificationsPage />} />
          <Route
            path="rh/capacitacoes"
            element={
              <Suspense fallback={<PageFallback />}>
                <TrainingPage />
              </Suspense>
            }
          />
          <Route
            path="rh/historico"
            element={
              <RequireAccess rule={{ anyOf: ["employment.manage_history"] }}>
                <Suspense fallback={<PageFallback />}>
                  <EmploymentHistoryPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/documentos"
            element={
              <RequireAccess
                rule={{ anyOf: ["documents.read", "documents.manage"] }}
              >
                <Suspense fallback={<PageFallback />}>
                  <DocumentsPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="rh/meu-dossie"
            element={
              <Suspense fallback={<PageFallback />}>
                <DossierPage />
              </Suspense>
            }
          />
          <Route
            path="rh/solicitacoes"
            element={
              <Suspense fallback={<PageFallback />}>
                <HrRequestsPage />
              </Suspense>
            }
          />
          {import.meta.env.DEV ? (
            <Route
              path="dev/ui"
              element={
                <Suspense fallback={<PageFallback />}>
                  <UiKitPage />
                </Suspense>
              }
            />
          ) : null}
          <Route
            path="pessoas"
            element={<Navigate to="/rh/colaboradores" replace />}
          />
          <Route path="ferias" element={<Navigate to="/rh/ferias" replace />} />
          <Route
            path="administracao"
            element={<Navigate to="/sistema/administracao" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function PageFallback() {
  return (
    <div className="space-y-4" aria-label="Carregando página" role="status">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--surface-subtle)]" />
      <div className="h-48 animate-pulse rounded-[14px] bg-[var(--surface-subtle)]" />
    </div>
  );
}
