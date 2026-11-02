import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
export const usingSupabaseAi = Boolean(supabaseUrl);
export const aiSetupHint = usingSupabaseAi
  ? "Check the DeepSeek secret and classroom-ai function in Supabase, then redeploy the function"
  : "For Supabase: add VITE_SUPABASE_URL in Vercel, then redeploy the website";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: supabaseUrl ? `${supabaseUrl}/functions/v1/classroom-ai` : "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: supabaseUrl ? "omit" : "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
