// Adapted from thunder-authentication's screens.example.ts pattern. THIS IS THE
// ONLY FILE THAT KNOWS ABOUT SCREENS — every screen names the one library-api
// operation it loads (or its submit makes, for a write-only form); the gate
// follows from that operation's scope in openapi.yaml, never from a role or a
// handle typed here.
//
// library-agent has no OpenAPI contract, so its two screens — Assistant and
// AddBookByPhoto — have no operation to gate on. `loads: null` is exactly the
// rare case this field exists for: reachable by any signed-in caller. See the
// report for this run: this is a design-contract limit (an ai-agent dependency
// carries no scope to bind a screen to), not a gate this file loosened.
//
// Rail order: Catalog, BookDetail, MyLoans, Assistant (the Member's flow), then
// ManageCatalog, AddEditBook, AddBookByPhoto, Overdue (the Librarian's flow) —
// the order wireframes.dsl declares its screens in.

import { canCall } from "./core";
import { OPERATIONS, isOperationKey, type OperationKey } from "./operations.gen";

export interface ScreenRoute {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly loads: OperationKey | null;
  readonly public?: boolean;
}

export const SCREEN_ROUTES: readonly ScreenRoute[] = [
  { key: "catalog", label: "Catalog", path: "/catalog", loads: "GET /books" },
  { key: "bookdetail", label: "Book Details", path: "/books/:bookId", loads: "GET /books/{bookId}" },
  { key: "myloans", label: "My Loans", path: "/my-loans", loads: "GET /me/loans" },
  { key: "assistant", label: "Assistant", path: "/assistant", loads: null },
  { key: "managecatalog", label: "Manage Catalog", path: "/manage-catalog", loads: "GET /books" },
  {
    key: "addeditbook",
    label: "Book Details",
    path: "/manage-catalog/books/:bookId?",
    loads: "POST /books",
  },
  {
    key: "addbookbyphoto",
    label: "Add Book by Photo",
    path: "/manage-catalog/add-by-photo",
    loads: null,
  },
  { key: "overdue", label: "Overdue Loans", path: "/overdue", loads: "GET /loans/overdue" },
];

for (const screen of SCREEN_ROUTES) {
  if (screen.loads !== null && !isOperationKey(screen.loads)) {
    throw new Error(
      `src/authz/screens.ts: screen "${screen.label}" loads "${screen.loads}", which ` +
        `no contract declares. Re-run \`npm run gen\`, or name the operation the ` +
        `way openapi.yaml spells it.`,
    );
  }
}

export function reachableScreens(
  scopes: ReadonlySet<string>,
  signedIn: boolean,
): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((screen) => {
    if (screen.public) return true;
    if (screen.loads === null) return signedIn;
    return canCall(OPERATIONS[screen.loads], scopes, signedIn);
  });
}

export function hasScopedReach(scopes: ReadonlySet<string>, signedIn: boolean): boolean {
  return reachableScreens(scopes, signedIn).some(
    (screen) => !screen.public && screen.loads !== null,
  );
}
