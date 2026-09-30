// Mock mode's stand-in for library-api and library-agent. State lives in
// module scope, not "on a server": any full page load (a reload, a typed URL,
// a link that leaves the SPA) re-runs this module and resets it to the seed
// below. Only in-app navigation carries a change forward.
//
// No scope check here — whether an operation may be called at all is
// mock/authz/gateway.ts's answer, read from library-api's openapi.yaml,
// exactly as it is the real gateway's answer in a cell. What a handler owes is
// its path's reach: a /me/ handler answers the caller's own rows, resolved
// from mockCaller below, never from a query parameter.
import { http, HttpResponse } from "msw";
import type { components } from "../src/generated/library-api";

type Book = components["schemas"]["Book"];
type Loan = components["schemas"]["Loan"];
type BookInput = components["schemas"]["BookInput"];

// The caller this mock speaks for. Fixed rather than read off the mock
// session, the same way mock-mode.md's own example does it: only the Member
// role ever calls /me/loans, and seeding one deliberately-owned row (plus one
// owned by somebody else, ln-3 below) is what makes "mine" and "everyone's"
// look different in the walk.
export const mockCaller = { userId: "mock-member", username: "Mock Member" };

let books: Book[] = [
  {
    id: "bk-1",
    title: "The Martian",
    author: "Andy Weir",
    genre: "Science Fiction",
    description: "An astronaut stranded on Mars fights to survive.",
    status: "on-loan",
  },
  {
    id: "bk-2",
    title: "Good Omens",
    author: "Terry Pratchett and Neil Gaiman",
    genre: "Comedy",
    description: "An angel and a demon team up to stop the apocalypse.",
    status: "on-loan",
  },
  {
    id: "bk-3",
    title: "Project Hail Mary",
    author: "Andy Weir",
    genre: "Science Fiction",
    description: "A lone astronaut must save humanity from extinction.",
    status: "available",
  },
  {
    id: "bk-4",
    title: "The Hitchhiker's Guide to the Galaxy",
    author: "Douglas Adams",
    genre: "Comedy",
    description: "An accidental journey across the galaxy after Earth's demolition.",
    status: "available",
  },
];

let loans: Loan[] = [
  {
    id: "ln-1",
    bookId: "bk-1",
    memberId: mockCaller.userId,
    borrowedAt: "2026-09-16",
    dueAt: "2026-09-30",
    returnedAt: null,
  },
  {
    id: "ln-2",
    bookId: "bk-2",
    memberId: mockCaller.userId,
    borrowedAt: "2026-08-01",
    dueAt: "2026-08-15",
    returnedAt: "2026-08-14",
  },
  {
    id: "ln-3",
    bookId: "bk-2",
    memberId: "user-123",
    borrowedAt: "2026-08-27",
    dueAt: "2026-09-10",
    returnedAt: null,
  },
];

let nextBookId = 5;
let nextLoanId = 4;

function withBook(loan: Loan): Loan {
  const book = books.find((b) => b.id === loan.bookId);
  return book ? { ...loan, book } : loan;
}

function page<T>(items: T[], query: URLSearchParams): { count: number; next: null; previous: null; data: T[] } {
  const limit = Number(query.get("limit") ?? "20");
  const offset = Number(query.get("offset") ?? "0");
  return { count: items.length, next: null, previous: null, data: items.slice(offset, offset + limit) };
}

function errorBody(code: number, message: string) {
  return { code, message };
}

export const handlers = [
  // Most specific first: /books/{id} before /books.
  http.get("/api/books/:bookId", ({ params }) => {
    const book = books.find((b) => b.id === params.bookId);
    if (!book) return HttpResponse.json(errorBody(404, "No such book"), { status: 404 });
    return HttpResponse.json(book);
  }),

  http.put("/api/books/:bookId", async ({ params, request }) => {
    const index = books.findIndex((b) => b.id === params.bookId);
    if (index === -1) return HttpResponse.json(errorBody(404, "No such book"), { status: 404 });
    const input = (await request.json()) as BookInput;
    if (!input?.title || !input?.author || !input?.genre) {
      return HttpResponse.json(errorBody(400, "Invalid book details"), { status: 400 });
    }
    books[index] = { ...books[index], ...input };
    return HttpResponse.json(books[index]);
  }),

  http.delete("/api/books/:bookId", ({ params }) => {
    const book = books.find((b) => b.id === params.bookId);
    if (!book) return HttpResponse.json(errorBody(404, "No such book"), { status: 404 });
    if (book.status === "on-loan") {
      return HttpResponse.json(
        errorBody(400, "The book is currently on loan and cannot be removed"),
        { status: 400 },
      );
    }
    books = books.filter((b) => b.id !== params.bookId);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/books", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams;
    let matching = books;
    const title = q.get("title");
    const author = q.get("author");
    const genre = q.get("genre");
    const status = q.get("status");
    if (title) matching = matching.filter((b) => b.title.toLowerCase().includes(title.toLowerCase()));
    if (author) matching = matching.filter((b) => b.author.toLowerCase().includes(author.toLowerCase()));
    if (genre) matching = matching.filter((b) => b.genre === genre);
    if (status) matching = matching.filter((b) => b.status === status);
    return HttpResponse.json(page(matching, q));
  }),

  http.post("/api/books", async ({ request }) => {
    const input = (await request.json()) as BookInput;
    if (!input?.title || !input?.author || !input?.genre) {
      return HttpResponse.json(errorBody(400, "Invalid book details"), { status: 400 });
    }
    const created: Book = {
      id: `bk-${nextBookId++}`,
      title: input.title,
      author: input.author,
      genre: input.genre,
      description: input.description ?? "",
      status: "available",
    };
    books = [...books, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  // /me/loans/{id}/return before /me/loans.
  http.post("/api/me/loans/:loanId/return", ({ params }) => {
    const index = loans.findIndex((l) => l.id === params.loanId && l.memberId === mockCaller.userId);
    if (index === -1) return HttpResponse.json(errorBody(404, "No such loan for the caller"), { status: 404 });
    if (loans[index].returnedAt) {
      return HttpResponse.json(errorBody(400, "The loan was already returned"), { status: 400 });
    }
    loans[index] = { ...loans[index], returnedAt: new Date().toISOString().slice(0, 10) };
    const bookIndex = books.findIndex((b) => b.id === loans[index].bookId);
    if (bookIndex !== -1) books[bookIndex] = { ...books[bookIndex], status: "available" };
    return HttpResponse.json(withBook(loans[index]));
  }),

  http.get("/api/me/loans", ({ request }) => {
    const url = new URL(request.url);
    const mine = loans.filter((l) => l.memberId === mockCaller.userId).map(withBook);
    return HttpResponse.json(page(mine, url.searchParams));
  }),

  http.post("/api/me/loans", async ({ request }) => {
    const input = (await request.json()) as { bookId?: string };
    if (!input?.bookId) return HttpResponse.json(errorBody(400, "The book is not available"), { status: 400 });
    const bookIndex = books.findIndex((b) => b.id === input.bookId);
    if (bookIndex === -1) return HttpResponse.json(errorBody(404, "No such book"), { status: 404 });
    if (books[bookIndex].status !== "available") {
      return HttpResponse.json(errorBody(400, "The book is not available"), { status: 400 });
    }
    const borrowedAt = new Date();
    const dueAt = new Date(borrowedAt);
    dueAt.setDate(dueAt.getDate() + 14);
    const created: Loan = {
      id: `ln-${nextLoanId++}`,
      bookId: input.bookId,
      memberId: mockCaller.userId,
      borrowedAt: borrowedAt.toISOString().slice(0, 10),
      dueAt: dueAt.toISOString().slice(0, 10),
      returnedAt: null,
    };
    loans = [...loans, created];
    books[bookIndex] = { ...books[bookIndex], status: "on-loan" };
    return HttpResponse.json(withBook(created), { status: 201 });
  }),

  http.get("/api/loans/overdue", ({ request }) => {
    const url = new URL(request.url);
    const today = "2026-09-30";
    const overdue = loans.filter((l) => l.returnedAt == null && l.dueAt < today).map(withBook);
    return HttpResponse.json(page(overdue, url.searchParams));
  }),

  // library-agent: the one fixed chat contract, an extra sibling reached at
  // /api/library-agent/chat. No OpenAPI contract backs it, so
  // mock/authz/gateway.ts enforces nothing on this path — matching production,
  // where the agent's own auth (if any) is not expressed in a contract this
  // app can read.
  http.post("/api/library-agent/chat", async ({ request }) => {
    const body = (await request.json()) as {
      conversationId?: string;
      message: string;
      attachments?: { name: string; mediaType: string; data: string }[];
    };
    const conversationId = body.conversationId ?? `mock-conv-${Date.now()}`;
    const message = body.message.toLowerCase();

    if (body.attachments && body.attachments.length > 0) {
      return HttpResponse.json({
        conversationId,
        text:
          "Title: Charlotte's Web\n" +
          "Author: E. B. White\n" +
          "Genre: Children's Fiction\n" +
          "Description: A pig named Wilbur is saved by his friend Charlotte, a clever spider.\n\n" +
          "Does that look right? Confirm and I'll add it to the catalog.",
        toolCalls: [],
      });
    }

    if (message.includes("add it with these details")) {
      const titleMatch = /title:\s*([^;]+)/i.exec(body.message);
      const title = titleMatch ? titleMatch[1].trim() : "New Book";
      const created: Book = {
        id: `bk-${nextBookId++}`,
        title,
        author: /author:\s*([^;]+)/i.exec(body.message)?.[1].trim() ?? "",
        genre: /genre:\s*([^;]+)/i.exec(body.message)?.[1].trim() ?? "",
        description: /description:\s*([^.]+)/i.exec(body.message)?.[1].trim() ?? "",
        status: "available",
      };
      books = [...books, created];
      return HttpResponse.json({
        conversationId,
        text: `Added "${title}" to the catalog.`,
        toolCalls: [],
      });
    }

    if (message.includes("due") || message.includes("loan")) {
      const mine = loans.filter((l) => l.memberId === mockCaller.userId && l.returnedAt == null).map(withBook);
      if (mine.length === 0) {
        return HttpResponse.json({
          conversationId,
          text: "You don't have any books on loan right now.",
          toolCalls: [],
        });
      }
      const loan = mine[0];
      return HttpResponse.json({
        conversationId,
        text: `Your copy of ${loan.book?.title ?? "that book"} is due ${loan.dueAt}.`,
        toolCalls: [],
      });
    }

    const available = books.filter((b) => b.status === "available").slice(0, 3);
    const suggestions = available
      .map((b) => `${b.title} by ${b.author} — a great pick if you're in that mood.`)
      .join("\n");
    return HttpResponse.json({
      conversationId,
      text: suggestions || "Nothing available quite fits that right now — check back soon.",
      toolCalls: [],
    });
  }),
];
