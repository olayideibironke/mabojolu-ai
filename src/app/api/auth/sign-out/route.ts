import { normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import { clearDevSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";
import { inspectServerEnv } from "@/lib/env";

/**
 * Sign out.
 *
 * POST rather than GET, so a prefetch, an image tag, or a crafted link cannot sign
 * a user out. Clears whichever session mechanism is configured.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const envResult = inspectServerEnv();

    if (envResult.ok && envResult.env.AUTH_MODE === "supabase") {
      const client = await createServerSupabaseClient();
      await client?.auth.signOut();
    } else {
      await clearDevSession();
    }

    return Response.json({ ok: true });
  } catch (cause) {
    return errorResponse(normalizeError(cause));
  }
}
