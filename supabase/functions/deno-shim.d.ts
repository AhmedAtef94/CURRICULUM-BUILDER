// =====================================================================
// Editor-only type shims for Supabase Edge Functions.
//
// These functions run on Deno inside Supabase, where `Deno` and the
// `https://esm.sh/...` imports resolve natively. VS Code's built-in
// (Node-flavoured) TypeScript server knows neither, so it reports false
// errors. This file teaches it just enough to stay quiet.
//
// It is NOT used at runtime and is NOT deployed — delete it if you ever
// install the Deno VS Code extension (see .vscode/settings.json).
// =====================================================================

declare namespace Deno {
  export const env: { get(key: string): string | undefined };
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): unknown;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  // Loose typing on purpose: the real types live in the Deno runtime.
  // deno-lint-ignore no-explicit-any
  export function createClient(url: string, key: string, options?: any): any;
}
