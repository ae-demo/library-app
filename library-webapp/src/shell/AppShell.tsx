// The signed-in app shell — every gated screen renders inside it. Structure
// follows oxygen-ui-design-system's sample AppLayout exactly: Header in
// AppShell.Navbar, Sidebar in AppShell.Sidebar, the routed page in
// AppShell.Main, Footer in AppShell.Footer.
//
// The wireframes draw a DIFFERENT sidebar per role (Member: Catalog/My
// Loans/Assistant; Librarian: Catalog(-> ManageCatalog)/Overdue), but this is
// the ONE rail every screen shares, each item wrapped in <Can> so it
// reproduces whichever picture the signed-in caller's scopes earn them —
// including the union, for a caller holding both roles' grants.
//
// The "Catalog" item is one link in both wireframes but points at a different
// screen per role (the member's browsing Catalog vs. the librarian's
// ManageCatalog) — that target is chosen from heldRoles(), same as the
// landing screen below; it is a link-target choice; it restricts nothing that
// <RequireOperation> was not already going to guard on its own route.

import type { JSX } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  AppShell,
  Header,
  Sidebar,
  Footer,
  UserMenu,
  ColorSchemeToggle,
  Divider,
} from "@wso2/oxygen-ui";
import { BookOpen, ClipboardList, MessageCircle, AlertTriangle, LogOut } from "@wso2/oxygen-ui-icons-react";
import { Can, useAuthz, useHeldRoles } from "../authz/gates";
import { signOut } from "../authz/session";
import { APP_NAME } from "../appName";

export function AppLayout(): JSX.Element {
  const { pathname } = useLocation();
  const { username } = useAuthz();
  const heldRoles = useHeldRoles();
  const isLibrarian = heldRoles.includes("Librarian");
  const catalogTarget = isLibrarian ? "/manage-catalog" : "/catalog";

  const active = pathname.startsWith("/manage-catalog") || pathname === "/catalog"
    ? "catalog"
    : pathname.startsWith("/my-loans")
      ? "myloans"
      : pathname.startsWith("/assistant")
        ? "assistant"
        : pathname.startsWith("/overdue")
          ? "overdue"
          : "catalog";

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <AppShell>
      <AppShell.Navbar>
        <Header>
          <Header.Toggle />
          <Header.Brand>
            <Header.BrandTitle>{APP_NAME}</Header.BrandTitle>
          </Header.Brand>
          <Header.Spacer />
          <Header.Actions>
            <ColorSchemeToggle />
            <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
            <UserMenu>
              <UserMenu.Trigger name={username || "Signed in"} />
              <UserMenu.Header name={username || "Signed in"} email="" />
              <UserMenu.Item icon={<LogOut />} label="Sign out" onClick={handleSignOut} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </AppShell.Navbar>

      <AppShell.Sidebar>
        <Sidebar activeItem={active}>
          <Sidebar.Nav>
            <Sidebar.Category>
              <Can op="GET /books">
                <Sidebar.Item id="catalog" link={<Link to={catalogTarget} />}>
                  <Sidebar.ItemIcon>
                    <BookOpen />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Catalog</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="GET /me/loans">
                <Sidebar.Item id="myloans" link={<Link to="/my-loans" />}>
                  <Sidebar.ItemIcon>
                    <ClipboardList />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>My Loans</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Sidebar.Item id="assistant" link={<Link to="/assistant" />}>
                <Sidebar.ItemIcon>
                  <MessageCircle />
                </Sidebar.ItemIcon>
                <Sidebar.ItemLabel>Assistant</Sidebar.ItemLabel>
              </Sidebar.Item>
              <Can op="GET /loans/overdue">
                <Sidebar.Item id="overdue" link={<Link to="/overdue" />}>
                  <Sidebar.ItemIcon>
                    <AlertTriangle />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Overdue</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
            </Sidebar.Category>
          </Sidebar.Nav>
        </Sidebar>
      </AppShell.Sidebar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Footer>
          <Footer.Copyright>© WSO2 LLC</Footer.Copyright>
        </Footer>
      </AppShell.Footer>
    </AppShell>
  );
}
