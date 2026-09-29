import { lazy, Suspense } from "react";

import { Navigate, Route, Routes } from "react-router";

import { RequireAuth } from "./auth";

import { AppShell } from "./components/app-shell";

import { RequireAccess } from "./components/require-access";

import { accessRules } from "./navigation";

import { ChangePasswordPage } from "./pages/change-password";

import { LoginPage } from "./pages/login";

import { NotificationsPage } from "./pages/notifications";
import { VisitConfirmationPage } from "./pages/visit-confirmation";

const AccountPage = lazy(() =>
  import("./pages/account").then((module) => ({
    default: module.AccountPage,
  })),
);

const AdminPage = lazy(() =>
  import("./pages/admin").then((module) => ({
    default: module.AdminPage,
  })),
);

const AuditPage = lazy(() =>
  import("./pages/audit").then((module) => ({
    default: module.AuditPage,
  })),
);

const DashboardPage = lazy(() =>
  import("./pages/dashboard").then((module) => ({
    default: module.DashboardPage,
  })),
);

const HubPage = lazy(() =>
  import("./pages/hub").then((module) => ({
    default: module.HubPage,
  })),
);

const PeoplePage = lazy(() =>
  import("./pages/people").then((module) => ({
    default: module.PeoplePage,
  })),
);

const UiKitPage = lazy(() =>
  import("./pages/ui-kit").then((module) => ({
    default: module.UiKitPage,
  })),
);

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
const DossierPage = lazy(() =>
  import("./pages/dossier").then((module) => ({ default: module.DossierPage })),
);
const HrRequestsPage = lazy(() =>
  import("./pages/hr-requests").then((module) => ({
    default: module.HrRequestsPage,
  })),
);

const VacationsPage = lazy(() =>
  import("./pages/vacations").then((module) => ({
    default: module.VacationsPage,
  })),
);

const TicketsPage = lazy(() =>
  import("./pages/tickets").then((module) => ({
    default: module.TicketsPage,
  })),
);
const NewTicketPage = lazy(() =>
  import("./pages/new-ticket").then((module) => ({
    default: module.NewTicketPage,
  })),
);

const AuditDocumentsPage = lazy(() =>
  import("./pages/audit-documents").then((module) => ({
    default: module.AuditDocumentsPage,
  })),
);
const AuditDocumentPage = lazy(() =>
  import("./pages/audit-document").then((module) => ({
    default: module.AuditDocumentPage,
  })),
);

const AuditMetricsPage = lazy(() =>
  import("./pages/audit-metrics").then((module) => ({
    default: module.AuditMetricsPage,
  })),
);

const VisitsPage = lazy(() =>
  import("./pages/visits").then((module) => ({
    default: module.VisitsPage,
  })),
);

const VisitManagePage = lazy(() =>
  import("./pages/visit-manage").then((module) => ({
    default: module.VisitManagePage,
  })),
);

const VisitAgendaPage = lazy(() =>
  import("./pages/visit-agenda").then((module) => ({
    default: module.VisitAgendaPage,
  })),
);

const VisitHistoryPage = lazy(() =>
  import("./pages/visit-history").then((module) => ({
    default: module.VisitHistoryPage,
  })),
);

const VisitReportsPage = lazy(() =>
  import("./pages/visit-reports").then((module) => ({
    default: module.VisitReportsPage,
  })),
);

const AssetsPage = lazy(() =>
  import("./modules/assets/AssetsPage").then((module) => ({
    default: module.AssetsPage,
  })),
);

const AssetListPage = lazy(() =>
  import("./modules/assets/AssetListPage").then((module) => ({
    default: module.AssetListPage,
  })),
);

const AssetDetailPage = lazy(() =>
  import("./modules/assets/AssetDetailPage").then((module) => ({
    default: module.AssetDetailPage,
  })),
);

const AssetCreatePage = lazy(() =>
  import("./modules/assets/AssetCreatePage").then((module) => ({
    default: module.AssetCreatePage,
  })),
);

const AssetEditPage = lazy(() =>
  import("./modules/assets/AssetEditPage").then((module) => ({
    default: module.AssetEditPage,
  })),
);

const AssetMovementPage = lazy(() =>
  import("./modules/assets/AssetMovementPage").then((module) => ({
    default: module.AssetMovementPage,
  })),
);

const AssetSectorPage = lazy(() =>
  import("./modules/assets/AssetSectorPage").then((module) => ({
    default: module.AssetSectorPage,
  })),
);

const AssetDisposalPage = lazy(() =>
  import("./modules/assets/AssetDisposalPage").then((module) => ({
    default: module.AssetDisposalPage,
  })),
);

const AssetReportsPage = lazy(() =>
  import("./modules/assets/AssetReportsPage").then((module) => ({
    default: module.AssetReportsPage,
  })),
);

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />

      <Route path="alterar-senha" element={<ChangePasswordPage />} />
      <Route
        path="visitas/confirmar/:token"
        element={<VisitConfirmationPage />}
      />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
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

          {/* VISITAS */}

          <Route
            path="visitas"
            element={
              <RequireAccess rule={accessRules.visits}>
                <Suspense fallback={<PageFallback />}>
                  <VisitsPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="visitas/nova"
            element={
              <RequireAccess rule={accessRules.visitsCreate}>
                <Suspense fallback={<PageFallback />}>
                  <VisitManagePage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="visitas/agenda"
            element={
              <RequireAccess rule={accessRules.visits}>
                <Suspense fallback={<PageFallback />}>
                  <VisitAgendaPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="visitas/historico"
            element={
              <RequireAccess rule={accessRules.visits}>
                <Suspense fallback={<PageFallback />}>
                  <VisitHistoryPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="visitas/relatorios"
            element={
              <RequireAccess rule={accessRules.visitsReports}>
                <Suspense fallback={<PageFallback />}>
                  <VisitReportsPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="suporte"
            element={
              <RequireAccess rule={accessRules.tickets}>
                <Suspense fallback={<PageFallback />}>
                  <TicketsPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="suporte/novo"
            element={
              <RequireAccess rule={accessRules.ticketsCreate}>
                <Suspense fallback={<PageFallback />}>
                  <NewTicketPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="controle-interno"
            element={<Navigate replace to="/controle-interno/documentos" />}
          />
          <Route
            path="controle-interno/documentos"
            element={
              <RequireAccess rule={accessRules.auditDocuments}>
                <Suspense fallback={<PageFallback />}>
                  <AuditDocumentsPage />
                </Suspense>
              </RequireAccess>
            }
          />
          <Route
            path="controle-interno/documentos/:id"
            element={
              <RequireAccess rule={accessRules.auditDocuments}>
                <Suspense fallback={<PageFallback />}>
                  <AuditDocumentPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="controle-interno/indicadores"
            element={
              <RequireAccess rule={accessRules.auditDocumentsReports}>
                <Suspense fallback={<PageFallback />}>
                  <AuditMetricsPage />
                </Suspense>
              </RequireAccess>
            }
          />

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

          {/*Rotas Gestão Patrimonial*/}

          <Route
            path="patrimonio"
            element={
              <RequireAccess rule={accessRules.patrimony}>
                <Suspense fallback={<PageFallback />}>
                  <AssetsPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/bens"
            element={
              <RequireAccess
                rule={{
                  anyOf: ["assets.read", "assets.manage"],
                }}
              >
                <Suspense fallback={<PageFallback />}>
                  <AssetListPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/bens/novo"
            element={
              <RequireAccess rule={accessRules.patrimonyManage}>
                <Suspense fallback={<PageFallback />}>
                  <AssetCreatePage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/bens/:id"
            element={
              <RequireAccess
                rule={{
                  anyOf: ["assets.read", "assets.manage"],
                }}
              >
                <AssetDetailPage />
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/bens/:id/editar"
            element={
              <RequireAccess rule={accessRules.patrimonyManage}>
                <AssetEditPage />
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/setores"
            element={
              <RequireAccess rule={accessRules.patrimonyManage}>
                <AssetSectorPage />
              </RequireAccess>
            }
          />
          <Route
            path="patrimonio/relatorios"
            element={
              <RequireAccess
                rule={{
                  anyOf: ["assets.read", "assets.manage"],
                }}
              >
                <Suspense fallback={<PageFallback />}>
                  <AssetReportsPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/bens/:id/movimentar"
            element={
              <RequireAccess rule={accessRules.patrimonyManage}>
                <AssetMovementPage />
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/bens/:id/baixa"
            element={
              <RequireAccess rule={accessRules.patrimonyManage}>
                <AssetDisposalPage />
              </RequireAccess>
            }
          />

          {/* SISTEMA */}

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

          <Route path="chamados" element={<Navigate to="/suporte" replace />} />

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
