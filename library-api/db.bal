import ballerina/sql;
import ballerina/time;
import ballerina/uuid;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

const int LOAN_PERIOD_DAYS = 14;

// The client is constructed lazily, on first use, rather than at module init:
// a module-level `check new(...)` would stop this service from STARTING at
// all whenever the database is not yet reachable (e.g. during a test run with
// no live Postgres). db-access functions below are what tests replace with
// @test:Mock, so the real client — and the real connection attempt — is never
// reached there either.
postgresql:Client? cachedDbClient = ();
boolean schemaReady = false;

function resolvedDbPort() returns int {
    if libraryDbPort == "" {
        return 5432;
    }
    int|error parsed = int:fromString(libraryDbPort);
    if parsed is int {
        return parsed;
    }
    return 5432;
}

function dbClient() returns postgresql:Client|error {
    postgresql:Client? existing = cachedDbClient;
    if existing is postgresql:Client {
        return existing;
    }
    postgresql:Client newClient = check new (
        host = libraryDbHost == "" ? "localhost" : libraryDbHost,
        username = libraryDbUser == "" ? "postgres" : libraryDbUser,
        password = libraryDbPassword == "" ? "postgres" : libraryDbPassword,
        database = libraryDbName == "" ? "library" : libraryDbName,
        port = resolvedDbPort()
    );
    check ensureSchema(newClient);
    cachedDbClient = newClient;
    return newClient;
}

function ensureSchema(postgresql:Client dbc) returns error? {
    if schemaReady {
        return;
    }
    _ = check dbc->execute(`
        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            genre TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'available'
        )
    `);
    _ = check dbc->execute(`
        CREATE TABLE IF NOT EXISTS loans (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            borrowed_at TEXT NOT NULL,
            due_at TEXT NOT NULL,
            returned_at TEXT
        )
    `);
    schemaReady = true;
}

// Row shapes selected off the database — column aliases match these field
// names case-insensitively (ballerinax/postgresql maps case-insensitively
// when the record defines the field).
type BookRow record {|
    string id;
    string title;
    string author;
    string genre;
    string? description;
    string status;
|};

type LoanJoinRow record {|
    string id;
    string bookId;
    string memberId;
    string borrowedAt;
    string dueAt;
    string? returnedAt;
    string bookTitle;
    string bookAuthor;
    string bookGenre;
    string? bookDescription;
    string bookStatus;
|};

function toBookStatus(string raw) returns "available"|"on-loan" {
    if raw == "on-loan" {
        return "on-loan";
    }
    return "available";
}

function toBook(BookRow row) returns Book {
    Book book = {
        id: row.id,
        title: row.title,
        author: row.author,
        genre: row.genre,
        status: toBookStatus(row.status)
    };
    string? description = row.description;
    if description is string {
        book.description = description;
    }
    return book;
}

function toLoanWithBook(LoanJoinRow row) returns Loan {
    Book book = {
        id: row.bookId,
        title: row.bookTitle,
        author: row.bookAuthor,
        genre: row.bookGenre,
        status: toBookStatus(row.bookStatus)
    };
    string? bookDescription = row.bookDescription;
    if bookDescription is string {
        book.description = bookDescription;
    }
    return {
        id: row.id,
        bookId: row.bookId,
        book: book,
        memberId: row.memberId,
        borrowedAt: row.borrowedAt,
        dueAt: row.dueAt,
        returnedAt: row.returnedAt
    };
}

function todayDate() returns string {
    return time:utcToString(time:utcNow()).substring(0, 10);
}

// `dueAt` is fixed at `borrowedAt` + two weeks (domain-model.md).
function dueDateFrom(string borrowedAt) returns string {
    time:Civil|time:Error civil = time:civilFromString(borrowedAt + "T00:00:00.000Z");
    if civil is time:Error {
        return borrowedAt;
    }
    time:Civil|time:Error updated = time:civilAddDuration(civil, {days: LOAN_PERIOD_DAYS});
    if updated is time:Error {
        return borrowedAt;
    }
    string|time:Error dueString = time:civilToString(updated);
    if dueString is time:Error {
        return borrowedAt;
    }
    return dueString.substring(0, 10);
}

function booksPageLink(string? title, string? author, string? genre, string? status, int pageLimit, int pageOffset) returns string {
    string link = string `/books?limit=${pageLimit}&offset=${pageOffset}`;
    if title is string {
        link += "&title=" + title;
    }
    if author is string {
        link += "&author=" + author;
    }
    if genre is string {
        link += "&genre=" + genre;
    }
    if status is string {
        link += "&status=" + status;
    }
    return link;
}

function simplePageLink(string basePath, int pageLimit, int pageOffset) returns string {
    return string `${basePath}?limit=${pageLimit}&offset=${pageOffset}`;
}

function previousOffset(int pageLimit, int pageOffset) returns int {
    int previous = pageOffset - pageLimit;
    return previous < 0 ? 0 : previous;
}

// --- Books ---------------------------------------------------------------

function listBooksFromDb(string? title, string? author, string? genre, string? status, int pageLimit, int pageOffset) returns BookPage|error {
    postgresql:Client dbc = check dbClient();

    sql:ParameterizedQuery whereClause = ` WHERE 1 = 1`;
    if title is string {
        whereClause = sql:queryConcat(whereClause, ` AND title ILIKE ${"%" + title + "%"}`);
    }
    if author is string {
        whereClause = sql:queryConcat(whereClause, ` AND author ILIKE ${"%" + author + "%"}`);
    }
    if genre is string {
        whereClause = sql:queryConcat(whereClause, ` AND genre ILIKE ${"%" + genre + "%"}`);
    }
    if status is string {
        whereClause = sql:queryConcat(whereClause, ` AND status = ${status}`);
    }

    int total = check dbc->queryRow(sql:queryConcat(`SELECT COUNT(*) FROM books`, whereClause));

    stream<BookRow, sql:Error?> rows = dbc->query(sql:queryConcat(
        `SELECT id, title, author, genre, description, status FROM books`,
        whereClause,
        ` ORDER BY title LIMIT ${pageLimit} OFFSET ${pageOffset}`
    ));
    Book[] books = [];
    check from BookRow row in rows
        do {
            books.push(toBook(row));
        };

    return {
        count: total,
        next: (pageOffset + pageLimit) < total ? booksPageLink(title, author, genre, status, pageLimit, pageOffset + pageLimit) : (),
        previous: pageOffset > 0 ? booksPageLink(title, author, genre, status, pageLimit, previousOffset(pageLimit, pageOffset)) : (),
        data: books
    };
}

function getBookFromDb(string bookId) returns Book|sql:NoRowsError|error {
    postgresql:Client dbc = check dbClient();
    BookRow|sql:Error row = dbc->queryRow(`SELECT id, title, author, genre, description, status FROM books WHERE id = ${bookId}`);
    if row is sql:NoRowsError {
        return row;
    }
    if row is sql:Error {
        return row;
    }
    return toBook(row);
}

function insertBookInDb(BookInput input) returns Book|error {
    postgresql:Client dbc = check dbClient();
    string id = uuid:createRandomUuid();
    string? description = input?.description;
    _ = check dbc->execute(`
        INSERT INTO books (id, title, author, genre, description, status)
        VALUES (${id}, ${input.title}, ${input.author}, ${input.genre}, ${description}, 'available')
    `);
    Book|sql:NoRowsError|error created = getBookFromDb(id);
    if created is Book {
        return created;
    }
    return error("failed to read back the book just inserted");
}

function updateBookInDb(string bookId, BookInput input) returns Book|sql:NoRowsError|error {
    postgresql:Client dbc = check dbClient();
    Book|sql:NoRowsError|error existing = getBookFromDb(bookId);
    if existing is sql:NoRowsError {
        return existing;
    }
    if existing is error {
        return existing;
    }
    string? description = input?.description;
    _ = check dbc->execute(`
        UPDATE books SET title = ${input.title}, author = ${input.author}, genre = ${input.genre}, description = ${description}
        WHERE id = ${bookId}
    `);
    Book|sql:NoRowsError|error updated = getBookFromDb(bookId);
    if updated is Book {
        return updated;
    }
    if updated is sql:NoRowsError {
        return updated;
    }
    return updated;
}

public type RemoveBookOutcome "deleted"|"not-found"|"on-loan";

function removeBookFromDb(string bookId) returns RemoveBookOutcome|error {
    postgresql:Client dbc = check dbClient();
    Book|sql:NoRowsError|error existing = getBookFromDb(bookId);
    if existing is sql:NoRowsError {
        return "not-found";
    }
    if existing is error {
        return existing;
    }
    if existing.status == "on-loan" {
        return "on-loan";
    }
    _ = check dbc->execute(`DELETE FROM books WHERE id = ${bookId}`);
    return "deleted";
}

// --- Loans -----------------------------------------------------------------

// Pure literal SQL — no `${}` inside, so every part of it is raw query text.
// Built once and reused via `sql:queryConcat`, never re-spliced as a string:
// splicing it into another backtick template's `${}` would bind it as a
// VALUE instead of raw SQL.
final sql:ParameterizedQuery loanJoinSelectQuery = `
    SELECT l.id AS id, l.book_id AS bookId, l.member_id AS memberId,
           l.borrowed_at AS borrowedAt, l.due_at AS dueAt, l.returned_at AS returnedAt,
           b.title AS bookTitle, b.author AS bookAuthor, b.genre AS bookGenre,
           b.description AS bookDescription, b.status AS bookStatus
    FROM loans l JOIN books b ON b.id = l.book_id
`;

function listMemberLoansFromDb(string memberId, int pageLimit, int pageOffset) returns LoanPage|error {
    postgresql:Client dbc = check dbClient();

    int total = check dbc->queryRow(`SELECT COUNT(*) FROM loans WHERE member_id = ${memberId}`);

    sql:ParameterizedQuery dataQuery = sql:queryConcat(
        loanJoinSelectQuery,
        ` WHERE l.member_id = ${memberId} ORDER BY l.borrowed_at DESC LIMIT ${pageLimit} OFFSET ${pageOffset}`
    );
    stream<LoanJoinRow, sql:Error?> rows = dbc->query(dataQuery);
    Loan[] loans = [];
    check from LoanJoinRow row in rows
        do {
            loans.push(toLoanWithBook(row));
        };

    return {
        count: total,
        next: (pageOffset + pageLimit) < total ? simplePageLink("/me/loans", pageLimit, pageOffset + pageLimit) : (),
        previous: pageOffset > 0 ? simplePageLink("/me/loans", pageLimit, previousOffset(pageLimit, pageOffset)) : (),
        data: loans
    };
}

function listOverdueLoansFromDb(int pageLimit, int pageOffset) returns LoanPage|error {
    postgresql:Client dbc = check dbClient();
    string today = todayDate();

    int total = check dbc->queryRow(`SELECT COUNT(*) FROM loans WHERE due_at < ${today} AND returned_at IS NULL`);

    sql:ParameterizedQuery dataQuery = sql:queryConcat(
        loanJoinSelectQuery,
        ` WHERE l.due_at < ${today} AND l.returned_at IS NULL ORDER BY l.due_at ASC LIMIT ${pageLimit} OFFSET ${pageOffset}`
    );
    stream<LoanJoinRow, sql:Error?> rows = dbc->query(dataQuery);
    Loan[] loans = [];
    check from LoanJoinRow row in rows
        do {
            loans.push(toLoanWithBook(row));
        };

    return {
        count: total,
        next: (pageOffset + pageLimit) < total ? simplePageLink("/loans/overdue", pageLimit, pageOffset + pageLimit) : (),
        previous: pageOffset > 0 ? simplePageLink("/loans/overdue", pageLimit, previousOffset(pageLimit, pageOffset)) : (),
        data: loans
    };
}

function loanWithBookById(string loanId) returns Loan|sql:NoRowsError|error {
    postgresql:Client dbc = check dbClient();
    sql:ParameterizedQuery q = sql:queryConcat(loanJoinSelectQuery, ` WHERE l.id = ${loanId}`);
    LoanJoinRow|sql:Error row = dbc->queryRow(q);
    if row is sql:NoRowsError {
        return row;
    }
    if row is sql:Error {
        return row;
    }
    return toLoanWithBook(row);
}

public type BorrowOutcome "not-found"|"not-available";

// Borrows an available book for the caller: creates the loan (two-week due
// date) and flips the book to `on-loan`, atomically.
function borrowBookInDb(string memberId, string bookId) returns Loan|BorrowOutcome|error {
    postgresql:Client dbc = check dbClient();
    Book|sql:NoRowsError|error book = getBookFromDb(bookId);
    if book is sql:NoRowsError {
        return "not-found";
    }
    if book is error {
        return book;
    }
    if book.status != "available" {
        return "not-available";
    }

    string loanId = uuid:createRandomUuid();
    string borrowedAt = todayDate();
    string dueAt = dueDateFrom(borrowedAt);

    transaction {
        _ = check dbc->execute(`
            INSERT INTO loans (id, book_id, member_id, borrowed_at, due_at, returned_at)
            VALUES (${loanId}, ${bookId}, ${memberId}, ${borrowedAt}, ${dueAt}, NULL)
        `);
        _ = check dbc->execute(`UPDATE books SET status = 'on-loan' WHERE id = ${bookId}`);
        check commit;
    }

    Loan|sql:NoRowsError|error created = loanWithBookById(loanId);
    if created is Loan {
        return created;
    }
    return error("failed to read back the loan just created");
}

public type ReturnOutcome "not-found"|"already-returned";

// Returns one of the caller's own loans: stamps `returnedAt` and flips the
// book back to `available`, atomically.
function returnLoanInDb(string memberId, string loanId) returns Loan|ReturnOutcome|error {
    postgresql:Client dbc = check dbClient();
    sql:ParameterizedQuery q = sql:queryConcat(
        loanJoinSelectQuery, ` WHERE l.id = ${loanId} AND l.member_id = ${memberId}`
    );
    LoanJoinRow|sql:Error existing = dbc->queryRow(q);
    if existing is sql:NoRowsError {
        return "not-found";
    }
    if existing is sql:Error {
        return existing;
    }
    if existing.returnedAt is string {
        return "already-returned";
    }

    string returnedAt = todayDate();
    transaction {
        _ = check dbc->execute(`UPDATE loans SET returned_at = ${returnedAt} WHERE id = ${loanId}`);
        _ = check dbc->execute(`UPDATE books SET status = 'available' WHERE id = ${existing.bookId}`);
        check commit;
    }

    Loan|sql:NoRowsError|error updated = loanWithBookById(loanId);
    if updated is Loan {
        return updated;
    }
    return error("failed to read back the loan just returned");
}
