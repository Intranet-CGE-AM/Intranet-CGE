import {
  lazy,
  Suspense,
} from "react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import {
  RequireAuth,
} from "./auth";

import {
  AppShell,
} from "./components/app-shell";

import {
  RequireAccess,
} from "./components/require-access";

import {
  accessRules,
} from "./navigation";

import {
  ChangePasswordPage,
} from "./pages/change-password";

import {
  LoginPage,
} from "./pages/login";


const AccountPage =
  lazy(() =>
    import(
      "./pages/account"
    ).then(
      (module) => ({
        default:
          module.AccountPage,
      }),
    ),
  );

const AdminPage =
  lazy(() =>
    import(
      "./pages/admin"
    ).then(
      (module) => ({
        default:
          module.AdminPage,
      }),
    ),
  );

const AuditPage =
  lazy(() =>
    import(
      "./pages/audit"
    ).then(
      (module) => ({
        default:
          module.AuditPage,
      }),
    ),
  );

const DashboardPage =
  lazy(() =>
    import(
      "./pages/dashboard"
    ).then(
      (module) => ({
        default:
          module.DashboardPage,
      }),
    ),
  );

const HubPage =
  lazy(() =>
    import(
      "./pages/hub"
    ).then(
      (module) => ({
        default:
          module.HubPage,
      }),
    ),
  );

const PeoplePage =
  lazy(() =>
    import(
      "./pages/people"
    ).then(
      (module) => ({
        default:
          module.PeoplePage,
      }),
    ),
  );

const UiKitPage =
  lazy(() =>
    import(
      "./pages/ui-kit"
    ).then(
      (module) => ({
        default:
          module.UiKitPage,
      }),
    ),
  );

const VacationsPage =
  lazy(() =>
    import(
      "./pages/vacations"
    ).then(
      (module) => ({
        default:
          module.VacationsPage,
      }),
    ),
  );

const VisitsPage =
  lazy(() =>
    import(
      "./pages/visits"
    ).then(
      (module) => ({
        default:
          module.VisitsPage,
      }),
    ),
  );

const VisitManagePage =
  lazy(() =>
    import(
      "./pages/visit-manage"
    ).then(
      (module) => ({
        default:
          module.VisitManagePage,
      }),
    ),
  );

const VisitAgendaPage =
  lazy(() =>
    import(
      "./pages/visit-agenda"
    ).then(
      (module) => ({
        default:
          module.VisitAgendaPage,
      }),
    ),
  );

const VisitHistoryPage =
  lazy(() =>
    import(
      "./pages/visit-history"
    ).then(
      (module) => ({
        default:
          module.VisitHistoryPage,
      }),
    ),
  );

const AssetsPage =
  lazy(() =>
    import(
      "./modules/assets/AssetsPage"
    ).then(
      (module) => ({
        default:
          module.AssetsPage,
      }),
    ),
  );

const AssetListPage = 
  lazy(()=>
    import(
      "./modules/assets/AssetListPage"
    ).then(
      (module)=> ({
        default:
          module.AssetListPage,
      }),
    ),
  );

const AssetDetailPage =
  lazy(async () => {
    const module =
      await import(
        "./modules/assets/AssetDatailPage"
      );

    return {
      default:
        module.AssetDetailPage,
    };
  });

const AssetCreatePage = 
lazy(()=>
  import(
    "./modules/assets/AssetCreatePage"    
  ).then(
    (module)=> ({
      default:
        module.AssetCreatePage,
    }),
  ),
);

const AssetSectorPage = lazy(
  () =>
    import(
      "./modules/assets/AssetSectorPage"
    ).then((module) => ({
      default:
        module.AssetSectorPage,
    })),
);


export function App() {
  return (
    <Routes>
      <Route
        path="login"
        element={
          <LoginPage />
        }
      />

      <Route
        path="alterar-senha"
        element={
          <ChangePasswordPage />
        }
      />

      <Route
        element={
          <RequireAuth />
        }
      >
        <Route
          element={
            <AppShell />
          }
        >
          <Route
            index
            element={
              <Suspense
                fallback={
                  <PageFallback />
                }
              >
                <HubPage />
              </Suspense>
            }
          />

          <Route
            path="rh"
            element={
              <RequireAccess
                rule={
                  accessRules.hr
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <DashboardPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="rh/colaboradores"
            element={
              <RequireAccess
                rule={
                  accessRules.people
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <PeoplePage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="rh/ferias"
            element={
              <RequireAccess
                rule={
                  accessRules.vacations
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <VacationsPage />
                </Suspense>
              </RequireAccess>
            }
          />

          {/* VISITAS */}

          <Route
            path="visitas"
            element={
              <RequireAccess
                rule={
                  accessRules.visits
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <VisitsPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="visitas/nova"
            element={
              <RequireAccess
                rule={
                  accessRules.visitsCreate
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <VisitManagePage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="visitas/agenda"
            element={
              <RequireAccess
                rule={
                  accessRules.visits
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <VisitAgendaPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="visitas/historico"
            element={
              <RequireAccess
                rule={
                  accessRules.visits
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <VisitHistoryPage />
                </Suspense>
              </RequireAccess>
            }
          />


          {/*Rotas Gestão Patrimonial*/}
        
          <Route
            path="patrimonio"
            element={
              <RequireAccess
                rule={
                  accessRules.patrimony
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <AssetsPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/bens" 
            element={
              <RequireAccess
                  rule={
                   {
                    anyOf:[
                      "assets.read",
                      "assets.manage"
                    ]
                   }
                  }
                  >
                  <Suspense
                    fallback={
                      <PageFallback/>
                    }>
                    <AssetListPage/>
                  </Suspense>
              </RequireAccess>
          }
          />

          <Route
            path="patrimonio/bens/novo"
            element={
              <RequireAccess
                // rule={
                //   accessRules.patrimony
                // }
                rule={
                   {
                    anyOf:[
                      "assets.manage"
                    ]
                   }
                  }
                >
                  <Suspense
                  fallback={
                    <PageFallback/>
                  }>
                  <AssetCreatePage/>
                  </Suspense>
              </RequireAccess>

            }
          />

          <Route
            path="patrimonio/bens/:id"
            element={
              <RequireAccess
                rule={{
                  anyOf: [
                    "assets.read",
                    "assets.manage",
                  ],
                }}
              >
                <AssetDetailPage />
              </RequireAccess>
            }
          />

          <Route
            path="patrimonio/setores"
            element={
              <RequireAccess
                rule={{
                  anyOf: [
                    "assets.read",
                    "assets.manage",
                  ],
                }}
              >
                <AssetSectorPage />
              </RequireAccess>
            }
          />



          {/* SISTEMA */}

          <Route
            path="sistema/administracao"
            element={
              <RequireAccess
                rule={
                  accessRules.administration
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <AdminPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="sistema/auditoria"
            element={
              <RequireAccess
                rule={
                  accessRules.audit
                }
              >
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <AuditPage />
                </Suspense>
              </RequireAccess>
            }
          />

          <Route
            path="conta"
            element={
              <Suspense
                fallback={
                  <PageFallback />
                }
              >
                <AccountPage />
              </Suspense>
            }
          />

          {import.meta.env.DEV ? (
            <Route
              path="dev/ui"
              element={
                <Suspense
                  fallback={
                    <PageFallback />
                  }
                >
                  <UiKitPage />
                </Suspense>
              }
            />
          ) : null}

          <Route
            path="pessoas"
            element={
              <Navigate
                to="/rh/colaboradores"
                replace
              />
            }
          />

          <Route
            path="ferias"
            element={
              <Navigate
                to="/rh/ferias"
                replace
              />
            }
          />

          <Route
            path="administracao"
            element={
              <Navigate
                to="/sistema/administracao"
                replace
              />
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

function PageFallback() {
  return (
    <div
      className="space-y-4"
      aria-label="Carregando página"
      role="status"
    >
      <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--surface-subtle)]" />

      <div className="h-48 animate-pulse rounded-[14px] bg-[var(--surface-subtle)]" />
    </div>
  );
}