import ballerina/crypto;
import ballerina/http;
import ballerina/jwt;
import ballerina/os;
import ballerina/test;

// Verifies AssertionInterceptor (gateway_assertion.bal) against a throwaway
// RSA keypair — never a real gateway or IdP. `GATEWAY_ASSERTION_CERTIFICATE`,
// `GATEWAY_ASSERTION_ISSUER` and `GATEWAY_ASSERTION_HEADER` must be exported
// (see tests/resources/README below) before `bal test` runs, or the
// interceptor falls back to its unverified mode and every case here would
// pass for the wrong reason.
//
// tests/resources/gateway-cert.pem + gateway-private-key.pem is the
// "gateway" throwaway keypair — its certificate is what
// GATEWAY_ASSERTION_CERTIFICATE carries. tests/resources/other-private-key.pem
// is an unrelated key used only to mint an assertion that does NOT verify
// against that certificate.

const string GATEWAY_KEY_FILE = "tests/resources/gateway-private-key.pem";
const string OTHER_KEY_FILE = "tests/resources/other-private-key.pem";
const string TEST_SUBJECT = "11111111-1111-1111-1111-111111111111";

final http:Client testClient = check new ("http://localhost:9090");

// GET /books is the document-default "any signed-in user" operation and
// reads no identity of its own, so it doubles as this suite's stand-in for a
// `security: []` resource: the interceptor's own behavior on a missing
// assertion is identical either way (continue with no caller on the
// context), and openapi.yaml declares no literal `security: []` operation
// for this service.
@test:Mock {
    functionName: "listBooksFromDb"
}
function mockListBooksFromDb(string? title, string? author, string? genre, string? status, int pageLimit, int pageOffset)
        returns BookPage|error {
    return {
        count: 1,
        data: [
            {id: "bk-1", title: "The Martian", author: "Andy Weir", genre: "Science Fiction", status: "available"}
        ]
    };
}

function mintAssertion(string keyFile) returns string|error {
    crypto:PrivateKey privateKey = check crypto:decodeRsaPrivateKeyFromKeyFile(keyFile);
    jwt:IssuerConfig issuerConfig = {
        issuer: os:getEnv("GATEWAY_ASSERTION_ISSUER"),
        username: TEST_SUBJECT,
        expTime: 300,
        customClaims: {
            "scope": "loans:read loans:borrow loans:return books:manage loans:read-overdue",
            "username": "test-member",
            "ouHandle": "acme"
        },
        signatureConfig: {
            config: privateKey
        }
    };
    return jwt:issue(issuerConfig);
}

function assertionHeaderName() returns string {
    return os:getEnv("GATEWAY_ASSERTION_HEADER");
}

// A valid assertion, signed by the same key the gateway's certificate names,
// is accepted.
@test:Config {}
function testValidAssertionAccepted() returns error? {
    string token = check mintAssertion(GATEWAY_KEY_FILE);
    http:Response resp = check testClient->get("/books", headers = {[assertionHeaderName()]: token});
    test:assertEquals(resp.statusCode, 200);
}

// An assertion signed by a DIFFERENT key never verifies against the
// configured certificate — 401, never treated as anonymous.
@test:Config {}
function testAssertionSignedByDifferentKeyRejected() returns error? {
    string token = check mintAssertion(OTHER_KEY_FILE);
    http:Response resp = check testClient->get("/books", headers = {[assertionHeaderName()]: token});
    test:assertEquals(resp.statusCode, 401);
}

// A validly-signed assertion whose payload was edited afterwards fails
// signature verification — 401, never treated as anonymous.
@test:Config {}
function testTamperedAssertionRejected() returns error? {
    string token = check mintAssertion(GATEWAY_KEY_FILE);
    string[] parts = re `\.`.split(token);
    if parts.length() != 3 {
        test:assertFail("expected a three-part JWT, got " + parts.length().toString() + " parts");
    }
    string payload = parts[1];
    string flippedFirstChar = payload.substring(0, 1) == "e" ? "f" : "e";
    string tamperedPayload = flippedFirstChar + payload.substring(1);
    string tampered = parts[0] + "." + tamperedPayload + "." + parts[2];

    http:Response resp = check testClient->get("/books", headers = {[assertionHeaderName()]: tampered});
    test:assertEquals(resp.statusCode, 401);
}

// No assertion header at all: the interceptor continues with no caller, and
// this resource needs none — 200.
@test:Config {}
function testNoAssertionAnswers200() returns error? {
    http:Response resp = check testClient->get("/books");
    test:assertEquals(resp.statusCode, 200);
}
