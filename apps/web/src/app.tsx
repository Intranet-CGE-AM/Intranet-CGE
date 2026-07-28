import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/app-shell";
import { AdminPage } from "./pages/admin";
import { DashboardPage } from "./pages/dashboard";
import { PeoplePage } from "./pages/people";
import { UiKitPage } from "./pages/ui-kit";
import { VacationsPage } from "./pages/vacations";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="pessoas" element={<PeoplePage />} />
        <Route path="ferias" element={<VacationsPage />} />
        <Route path="administracao" element={<AdminPage />} />
        {import.meta.env.DEV ? (
          <Route path="dev/ui" element={<UiKitPage />} />
        ) : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
