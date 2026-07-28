import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { RequireAuth } from "./auth";
import { AppShell } from "./components/app-shell";
import { ChangePasswordPage } from "./pages/change-password";
import { LoginPage } from "./pages/login";

const AdminPage = lazy(() =>
  import("./pages/admin").then((module) => ({ default: module.AdminPage })),
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
              <Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="rh/colaboradores"
            element={
              <Suspense fallback={<PageFallback />}>
                <PeoplePage />
              </Suspense>
            }
          />
          <Route
            path="rh/ferias"
            element={
              <Suspense fallback={<PageFallback />}>
                <VacationsPage />
              </Suspense>
            }
          />
          <Route
            path="sistema/administracao"
            element={
              <Suspense fallback={<PageFallback />}>
                <AdminPage />
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
