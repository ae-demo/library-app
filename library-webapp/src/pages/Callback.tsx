// The one registered redirect URI, serving both the redirect leg and the
// silent-renew leg (thunder-authentication's session.ts#handleCallback docs
// why this route must call signinCallback() and not signinRedirectCallback()).
import { useEffect, type JSX } from "react";
import { handleCallback } from "../authz/session";

export function CallbackPage(): JSX.Element {
  useEffect(() => {
    void handleCallback().then(() => {
      // The redirect leg lands here with no router history of its own;
      // returning to the app root lets the sign-in guard pick up from there.
      if (window.opener === null && window.parent === window) {
        window.location.assign("/");
      }
    });
  }, []);

  return (
    <main>
      <p>Signing you in…</p>
    </main>
  );
}
