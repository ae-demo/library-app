// Typed read of window._env_, the platform's runtime config. Declares only the
// keys this app actually has: the four `<DEP>_*` OIDC keys the SPA reads for
// its `user-auth` dependency (JWKS_URL is deliberately absent — the browser
// never validates a token, the API gateway does). There is no sibling API URL
// key here: library-api and library-agent are reached same-origin at /api
// (react-webapp's Constraints).

type Env = {
  USER_AUTH_CLIENT_ID: string;
  USER_AUTH_ISSUER: string;
  USER_AUTH_SCOPES: string;
  USER_AUTH_RESOURCE: string;
};

declare global {
  interface Window {
    _env_: Env;
  }
}

if (!window._env_) {
  throw new Error(
    "window._env_ not set — /env-config.js failed to load. " +
      "The platform mounts this file; if you see this locally, host " +
      "/env-config.js from your dev server.",
  );
}

export const env: Env = window._env_;
