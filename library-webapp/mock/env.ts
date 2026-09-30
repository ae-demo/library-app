// mockEnv carries exactly the keys the platform actually emits for this
// component: the four <DEP>_* OIDC keys for the `user-auth` dependency (no
// JWKS_URL — src/env.ts does not declare it either). There is no sibling API
// URL here: library-api and library-agent are same-origin /api, never a
// window._env_ key.
export const mockEnv = {
  USER_AUTH_CLIENT_ID: "mock-client",
  USER_AUTH_ISSUER: "https://mock-idp.test",
  USER_AUTH_SCOPES:
    "openid profile email group ou books:manage loans:read loans:borrow loans:return loans:read-overdue",
  USER_AUTH_RESOURCE: "https://mock-idp.test/resources/mock-project",
};
