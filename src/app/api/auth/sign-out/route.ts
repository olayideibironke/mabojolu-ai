import { normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import { clearDevSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";
import { authRuntimeMode } from "@/lib/runtime-mode";

/**
 * Sign out.
 *
 * POST rather than GET, so a prefetch, an image tag, or a crafted link cannot
 * sign a user out.
 *
 * Authentication mode is resolved directly instead of depending on whole-app
 * environment validation. A failure in an unrelated provider or integration
 * must never make Mabojolu clear the wrong session type.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    if (
      authRuntimeMode() ===
      "supabase"
    ) {
      const client =
        await createServerSupabaseClient();

      if (!client) {
        throw new Error(
          "Supabase authentication is not configured.",
        );
      }

      const {
        error,
      } =
        await client.auth.signOut();

      if (error) {
        throw error;
      }
    } else {
      await clearDevSession();
    }

    return Response.json(
      {
        ok: true,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (cause) {
    return errorResponse(
      normalizeError(
        cause,
      ),
    );
  }
}
