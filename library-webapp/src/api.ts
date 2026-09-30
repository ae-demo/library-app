// The typed client for library-api, reached same-origin at /api (nginx
// reverse-proxies to the sibling — react-webapp's Same-origin API proxy).
// Authorization is entirely src/authz/client.ts's: this file attaches the
// bearer and applies the 401 rule through its two exported functions and adds
// nothing of its own about authorization.

import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/library-api";
import { authorizationHeader, classifyResponse, ForbiddenError } from "./authz/client";

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const header = await authorizationHeader();
    if (header) request.headers.set("Authorization", header);
    return request;
  },
  async onResponse({ response }) {
    if ((await classifyResponse(response.status)) === "forbidden") {
      throw new ForbiddenError(response.status);
    }
    return response;
  },
};

export const libraryApi = createClient<paths>({ baseUrl: "/api" });
libraryApi.use(authMiddleware);
