# library-app — PRD

## Problem Statement

Members who want to find and borrow books today have no easy way to search the
library's shelf, see what's available, or get a suggestion when they don't
know exactly what they're looking for — and no simple way to check on their
own loans without asking a librarian directly. Librarians, meanwhile, have no
single place to manage the catalog or spot overdue books.

## Solution

A simple library app where members sign in to browse and search the catalog,
borrow and return books, get mood-based suggestions in their own words, and
ask plain-language questions about their own loans — while librarians manage
the book catalog and keep track of overdue books.

## Actors

- **Member**: signs in, browses and searches the catalog, borrows and returns
books, asks for mood-based suggestions, and asks plain-language questions
about their own loans.
- **Librarian**: adds, edits and removes books in the catalog, and sees which
books are overdue.

## User Stories

1. As a Member, I want to sign in to the library app, so that I can access my
 account securely.
2. As a Member, I want to browse and search the books by title, author,
 genre, and whether they're available or on loan, so that I can find books
 I'm interested in.
3. As a Member, I want to borrow an available book for two weeks, so that I
 can read it.
4. As a Member, I want to return a book I've borrowed, so that it becomes
 available for others.
5. As a Member, I want to describe what I'm in the mood for in my own words
 (like "something light and funny for a long flight" or "a short book
 about space, like The Martian"), so that I get two or three suggestions
 from books that are available now, each with a one-line reason.
6. As a Member, I want to ask about my own loans in plain language (like
 "when is my book due?" or "what have I borrowed this year?"), so that I
 get answers based on my real loan history.
7. As a Librarian, I want to add, edit and remove books, so that the catalog
 stays accurate and up to date.
8. As a Librarian, I want to see which books are overdue, so that I can
 follow up on them.

## Product Decisions

- Sign-in: every Member and Librarian signs in via SSO through Thunder, the
platform IDP.
- Member and Librarian accounts are provisioned by the organization rather
than by self-service sign-up, since the product does not describe people
signing themselves up.
- Loan duration is fixed at two weeks, with no renewal or extension.
- Book suggestions from a mood description are produced by an agent that
reads the member's free-text description and the catalog of currently
available books, and returns two or three suggestions, each with a
one-line reason. *assumed*
- Answers to plain-language loan questions are produced by an agent that
reads the member's own loan records and answers using only their real
loan history. *assumed*
- No fines or late fees are charged for overdue books; librarians handle
overdue books by following up directly. *assumed*
- A book currently on loan cannot be removed from the catalog until it is
returned. *assumed*

## Out of Scope

- Loan renewals or extensions.
- Reservations or a holds queue for books currently on loan.
- Fines, late fees, or any payment processing.
- Automated overdue reminder notifications (email or SMS) to members.
- Self-service member sign-up.

## Open Questions

None currently — every point raised during the interview has either been
settled as a Product Decision (marked `*assumed*` where the agent decided) or
recorded as Out of Scope.

## Further Notes

None.