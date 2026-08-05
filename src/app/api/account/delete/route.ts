import type { NextRequest } from "next/server";

import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/auth/supabase-server";
import { SupabaseDatabaseAdapter } from "@/lib/database/supabase-adapter";
import { inspectServerEnv } from "@/lib/env";

/**
 * Permanently delete the currently authenticated Mabojolu account.
 *
 * The authenticated client identifies the requester. The privileged client is
 * used only after ownership has been established, and it never reaches the
 * browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeleteAccountPayload {
  confirmation?: unknown;
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const envResult = inspectServerEnv();

    if (!envResult.ok || envResult.env.AUTH_MODE !== "supabase") {
      return Response.json(
        {
          error: "Account deletion is unavailable in this environment.",
        },
        {
          status: 409,
        },
      );
    }

    let payload: DeleteAccountPayload;

    try {
      payload = (await request.json()) as DeleteAccountPayload;
    } catch {
      return Response.json(
        {
          error: "A valid deletion confirmation is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (payload.confirmation !== "DELETE") {
      return Response.json(
        {
          error: "Type DELETE exactly to confirm account deletion.",
        },
        {
          status: 400,
        },
      );
    }

    const userClient = await createServerSupabaseClient();
    const serviceClient = createServiceRoleClient();

    if (!userClient || !serviceClient) {
      return Response.json(
        {
          error: "Account deletion is not configured.",
        },
        {
          status: 503,
        },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return Response.json(
        {
          error: "You must be signed in to delete your account.",
        },
        {
          status: 401,
        },
      );
    }

    const database = new SupabaseDatabaseAdapter();

    await database.deleteAllUserData(user.id);

    const { error: deleteUserError } =
      await serviceClient.auth.admin.deleteUser(user.id, false);

    if (deleteUserError) {
      console.error("[mabojolu] authentication account deletion failed", {
        userId: user.id,
        message: deleteUserError.message,
      });

      return Response.json(
        {
          error:
            "Your account could not be completely deleted. Please try again.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * The authentication account no longer exists, but signOut also clears the
     * session cookies held by this browser.
     */
    await userClient.auth.signOut();

    return Response.json({
      ok: true,
    });
  } catch (cause) {
    console.error("[mabojolu] account deletion failed", {
      message:
        cause instanceof Error
          ? cause.message
          : "Unknown account deletion error",
    });

    return Response.json(
      {
        error: "Mabojolu could not delete your account. Please try again.",
      },
      {
        status: 500,
      },
    );
  }
}