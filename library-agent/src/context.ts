import { AsyncLocalStorage } from "node:async_hooks";

// Per-request credential, reachable from a tool without the model ever
// seeing it. The handler runs the whole turn inside callContext.run(); tools
// in tools.ts read it back out via getStore().
export const callContext = new AsyncLocalStorage<{ authorization?: string }>();
