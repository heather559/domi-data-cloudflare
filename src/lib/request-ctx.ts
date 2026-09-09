import { AsyncLocalStorage } from "node:async_hooks";

export type RequestCtx = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export const requestCtxStorage = new AsyncLocalStorage<RequestCtx>();

/**
 * Run `fn` after the current response has been sent, extending the worker
 * lifetime via ctx.waitUntil when available. Falls back to fire-and-forget
 * (which may be cancelled on Cloudflare) when no ctx is bound.
 */
export function runAfterResponse(fn: () => Promise<unknown>): void {
  const store = requestCtxStorage.getStore();
  const promise = Promise.resolve().then(fn).catch((err) => {
    console.error("[runAfterResponse] task failed", err);
  });
  if (store?.waitUntil) {
    try {
      store.waitUntil(promise);
    } catch (err) {
      console.error("[runAfterResponse] waitUntil failed", err);
    }
  }
}
