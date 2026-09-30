// Adapted from thunder-authentication's App.example.tsx pattern for this app's
// own screens and name. The ROUTING STRUCTURE is prescribed:
//
//   NoAccess sits ABOVE the shell route and REPLACES it.
//   Forbidden sits INSIDE the shell, at /forbidden.
//   /forbidden is wired into authz/client once, from the router (ForbiddenWiring).
//   Every gated route is wrapped in <RequireOperation>, the operation taken
//     from SCREEN_ROUTES — never a handle typed here.
//   /callback is routed OUTSIDE the provider.
//
// The one addition this app makes: landing is role-aware rather than "first
// reachable in table order", because Catalog's own load operation (GET /books)
// is `signedIn` — reachable by BOTH roles — so the generic rule would always
// land a Librarian on Catalog too. The issue's acceptance criterion is
// explicit: a Member lands on Catalog, a Librarian on ManageCatalog. heldRoles()
// is used for this UX choice only, never to decide reachability — every route
// stays gated on its own operation regardless of which screen a caller lands on.

import { useEffect, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  AuthzProvider,
  Forbidden,
  NoAccess,
  RequireOperation,
  useAuthz,
  useHeldRoles,
  useScopes,
} from "./authz/gates";
import { SCREEN_ROUTES, reachableScreens, hasScopedReach } from "./authz/screens";
import { setForbiddenNavigator } from "./authz/client";
import { signIn } from "./authz/session";
import { AppLayout } from "./shell/AppShell";
import { CallbackPage } from "./pages/Callback";
import { CatalogPage } from "./pages/Catalog";
import { BookDetailPage } from "./pages/BookDetail";
import { MyLoansPage } from "./pages/MyLoans";
import { AssistantPage } from "./pages/Assistant";
import { ManageCatalogPage } from "./pages/ManageCatalog";
import { AddEditBookPage } from "./pages/AddEditBook";
import { AddBookByPhotoPage } from "./pages/AddBookByPhoto";
import { OverduePage } from "./pages/Overdue";
import { APP_NAME } from "./appName";

const PAGE_BY_KEY: Record<string, ReactElement> = {
  catalog: <CatalogPage />,
  bookdetail: <BookDetailPage />,
  myloans: <MyLoansPage />,
  assistant: <AssistantPage />,
  managecatalog: <ManageCatalogPage />,
  addeditbook: <AddEditBookPage />,
  addbookbyphoto: <AddBookByPhotoPage />,
  overdue: <OverduePage />,
};

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <ForbiddenWiring />
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        <Route
          path="*"
          element={
            <AuthzProvider fallback={<Splash />}>
              <SignedIn />
            </AuthzProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function ForbiddenWiring(): null {
  const navigate = useNavigate();
  useEffect(() => {
    setForbiddenNavigator(() => navigate("/forbidden", { replace: true }));
  }, [navigate]);
  return null;
}

function Splash(): ReactElement {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>Checking your session…</p>
    </main>
  );
}

function SignedIn(): ReactElement {
  const { signedIn } = useAuthz();
  const scopes = useScopes();
  const heldRoles = useHeldRoles();

  useEffect(() => {
    if (!signedIn) void signIn();
  }, [signedIn]);

  if (!signedIn) return <Splash />;

  const reachable = reachableScreens(scopes, signedIn);

  if (!hasScopedReach(scopes, signedIn)) return <NoAccess appName={APP_NAME} />;

  const preferredKey = heldRoles.includes("Librarian") ? "managecatalog" : "catalog";
  const landing = (
    reachable.find((s) => s.key === preferredKey) ??
    reachable.find((s) => !s.public && s.loads !== null) ??
    reachable[0]
  ).path;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={landing} replace />} />
        {SCREEN_ROUTES.map((screen) => {
          const page = PAGE_BY_KEY[screen.key];
          if (screen.loads === null) {
            return <Route key={screen.key} path={screen.path} element={page} />;
          }
          return (
            <Route
              key={screen.key}
              element={<RequireOperation op={screen.loads} screen={screen.label} />}
            >
              <Route path={screen.path} element={page} />
            </Route>
          );
        })}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<Navigate to={landing} replace />} />
      </Route>
    </Routes>
  );
}
