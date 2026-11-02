import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: { role: string };
};

export function createContext(
  opts: FetchCreateContextFnOptions,
): TrpcContext {
  return { req: opts.req, resHeaders: opts.resHeaders };
}
