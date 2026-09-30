import ballerina/http;

// Wire types — shaped exactly to openapi.yaml's schemas.

public type Book record {|
    string id;
    string title;
    string author;
    string genre;
    string description?;
    "available"|"on-loan" status;
|};

public type BookInput record {|
    string title;
    string author;
    string genre;
    string description?;
|};

public type Loan record {|
    string id;
    string bookId;
    Book book?;
    string memberId;
    string borrowedAt;
    string dueAt;
    string? returnedAt = ();
|};

public type BorrowBookRequest record {|
    string bookId;
|};

public type BookPage record {|
    int count;
    string? next = ();
    string? previous = ();
    Book[] data;
|};

public type LoanPage record {|
    int count;
    string? next = ();
    string? previous = ();
    Loan[] data;
|};

public type ErrorPayload record {|
    int code;
    string message;
    string description?;
    string moreInfo?;
|};

public type ErrorBadRequest record {|
    *http:BadRequest;
    ErrorPayload body;
|};

public type ErrorNotFound record {|
    *http:NotFound;
    ErrorPayload body;
|};

public type ErrorForbidden record {|
    *http:Forbidden;
    ErrorPayload body;
|};

public type ErrorUnauthorized record {|
    *http:Unauthorized;
    ErrorPayload body;
|};
