import ballerina/http;
import ballerina/log;
import ballerina/sql;

// Book catalog and member loans (openapi.yaml). The gateway has already
// enforced sign-in and the operation's declared scope before a request
// reaches here — this service holds no operation -> scope table. Identity is
// only resolved for a `/me/...` operation, through the verified gateway
// assertion, never a client-supplied id (see gateway_assertion.bal).
listener http:Listener ep0 = new (9090);

function errorPayload(int code, string message) returns ErrorPayload => {code: code, message: message};

service http:InterceptableService / on ep0 {

    public function createInterceptors() returns AssertionInterceptor => new;

    # Search the catalog — every signed-in user.
    resource function get books(string? title, string? author, string? genre,
            "available"|"on-loan"? status, int 'limit = 20, int offset = 0)
            returns BookPage|http:InternalServerError {
        BookPage|error page = listBooksFromDb(title, author, genre, status, capLimit('limit), offset);
        if page is error {
            log:printError("listBooks failed", page);
            return <http:InternalServerError>{body: errorPayload(500, "failed to list books")};
        }
        return page;
    }

    # Add a book to the catalog.
    resource function post books(@http:Payload BookInput payload)
            returns http:Created|ErrorBadRequest|http:InternalServerError {
        ErrorBadRequest? invalid = validateBookInput(payload);
        if invalid is ErrorBadRequest {
            return invalid;
        }
        Book|error created = insertBookInDb(payload);
        if created is error {
            log:printError("addBook failed", created);
            return <http:InternalServerError>{body: errorPayload(500, "failed to add book")};
        }
        return <http:Created>{body: created};
    }

    # Read one book — every signed-in user.
    resource function get books/[string bookId]() returns Book|ErrorNotFound|http:InternalServerError {
        Book|sql:NoRowsError|error found = getBookFromDb(bookId);
        if found is sql:NoRowsError {
            return <ErrorNotFound>{body: errorPayload(404, "no such book")};
        }
        if found is error {
            log:printError("getBook failed", found);
            return <http:InternalServerError>{body: errorPayload(500, "failed to read book")};
        }
        return found;
    }

    # Edit a book's details.
    resource function put books/[string bookId](@http:Payload BookInput payload)
            returns Book|ErrorBadRequest|ErrorNotFound|http:InternalServerError {
        ErrorBadRequest? invalid = validateBookInput(payload);
        if invalid is ErrorBadRequest {
            return invalid;
        }
        Book|sql:NoRowsError|error updated = updateBookInDb(bookId, payload);
        if updated is sql:NoRowsError {
            return <ErrorNotFound>{body: errorPayload(404, "no such book")};
        }
        if updated is error {
            log:printError("editBook failed", updated);
            return <http:InternalServerError>{body: errorPayload(500, "failed to update book")};
        }
        return updated;
    }

    # Remove a book from the catalog — refused while it is on loan.
    resource function delete books/[string bookId]()
            returns http:NoContent|ErrorBadRequest|ErrorNotFound|http:InternalServerError {
        RemoveBookOutcome|error outcome = removeBookFromDb(bookId);
        if outcome is error {
            log:printError("removeBook failed", outcome);
            return <http:InternalServerError>{body: errorPayload(500, "failed to remove book")};
        }
        if outcome is "not-found" {
            return <ErrorNotFound>{body: errorPayload(404, "no such book")};
        }
        if outcome is "on-loan" {
            return <ErrorBadRequest>{body: errorPayload(400, "the book is currently on loan and cannot be removed")};
        }
        return http:NO_CONTENT;
    }

    # The caller's own loans.
    resource function get me/loans(http:RequestContext ctx, int 'limit = 20, int offset = 0)
            returns LoanPage|http:Unauthorized|http:InternalServerError {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        LoanPage|error page = listMemberLoansFromDb(caller.userId, capLimit('limit), offset);
        if page is error {
            log:printError("listMyLoans failed", page);
            return <http:InternalServerError>{body: errorPayload(500, "failed to list loans")};
        }
        return page;
    }

    # Borrow an available book as the caller — due in two weeks.
    resource function post me/loans(http:RequestContext ctx, @http:Payload BorrowBookRequest payload)
            returns http:Created|ErrorBadRequest|ErrorNotFound|http:Unauthorized|http:InternalServerError {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        Loan|BorrowOutcome|error outcome = borrowBookInDb(caller.userId, payload.bookId);
        if outcome is error {
            log:printError("borrowBook failed", outcome);
            return <http:InternalServerError>{body: errorPayload(500, "failed to borrow book")};
        }
        if outcome is "not-found" {
            return <ErrorNotFound>{body: errorPayload(404, "no such book")};
        }
        if outcome is "not-available" {
            return <ErrorBadRequest>{body: errorPayload(400, "the book is not available")};
        }
        return <http:Created>{body: outcome};
    }

    # Return one of the caller's own loans — the book becomes available again.
    resource function post me/loans/[string loanId]/'return(http:RequestContext ctx)
            returns Loan|ErrorBadRequest|ErrorNotFound|http:Unauthorized|http:InternalServerError {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        Loan|ReturnOutcome|error outcome = returnLoanInDb(caller.userId, loanId);
        if outcome is error {
            log:printError("returnLoan failed", outcome);
            return <http:InternalServerError>{body: errorPayload(500, "failed to return loan")};
        }
        if outcome is "not-found" {
            // The loan does not exist, or exists but is not the caller's —
            // a row that is not the caller's does not exist to the caller.
            return <ErrorNotFound>{body: errorPayload(404, "no such loan for the caller")};
        }
        if outcome is "already-returned" {
            return <ErrorBadRequest>{body: errorPayload(400, "the loan was already returned")};
        }
        return outcome;
    }

    # Every overdue loan — for librarians.
    resource function get loans/overdue(int 'limit = 20, int offset = 0)
            returns LoanPage|http:InternalServerError {
        LoanPage|error page = listOverdueLoansFromDb(capLimit('limit), offset);
        if page is error {
            log:printError("listOverdueLoans failed", page);
            return <http:InternalServerError>{body: errorPayload(500, "failed to list overdue loans")};
        }
        return page;
    }
}

// openapi.yaml caps `limit` at 100; clamp rather than trust the caller.
function capLimit(int requested) returns int {
    if requested < 1 {
        return 20;
    }
    if requested > 100 {
        return 100;
    }
    return requested;
}

function validateBookInput(BookInput input) returns ErrorBadRequest? {
    if input.title.trim() == "" || input.author.trim() == "" || input.genre.trim() == "" {
        return <ErrorBadRequest>{body: errorPayload(400, "title, author and genre are required")};
    }
    return ();
}
