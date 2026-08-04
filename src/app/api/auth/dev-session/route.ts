import type { NextRequest } from "next/server";

import { chatError, normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import {
  clearDevSession,
  devUsers,
  setDevSession,
} from "@/lib/auth/session";
import { inspectServerEnv } from "@/lib/env";

/**
 * Development sign-in.
 *
 * Exists so authentication, ownership boundaries, and per-user limits can be
 * exercised without an auth provider, and so switching between two local
 * identities can demonstrate that one user cannot read another's conversations.
 *
 * Guarded three ways, because a development bypass reaching production would
 * expose every account: environment validation refuses `AUTH_MODE=dev` in
 * production, `setDevSession` refuses it again, and this route refuses to exist
 * outside dev mode. Any one of these failing is not enough to open it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function devModeAvailable(): boolean {
  const envResult = inspectServerEnv();

  return (
    envResult.ok &&
    envResult.env.AUTH_MODE === "dev" &&
    envResult.env.NODE_ENV !== "production"
  );
}

/** List the available local identities, for the sign-in page. */
export function GET(): Response {
  if (!devModeAvailable()) {
    return errorResponse(chatError("not_found"));
  }

  return Response.json(
    {
      users: devUsers().map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!devModeAvailable()) {
      return errorResponse(chatError("not_found"));
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse(
        chatError("invalid_request", { message: "That request could not be read." }),
      );
    }

    const userId =
      typeof rawBody === "object" && rawBody !== null && "userId" in rawBody
        ? String((rawBody as { userId: unknown }).userId)
        : "";

    // Only the two known identities are accepted, so this cannot mint arbitrary
    // users even in development.
    const applied = await setDevSession(userId);

    if (!applied) {
      return errorResponse(
        chatError("invalid_request", { message: "That local user is not available." }),
      );
    }

    return Response.json({ ok: true });
  } catch (cause) {
    return errorResponse(normalizeError(cause));
  }
}

/** Sign out. */
export async function DELETE(): Promise<Response> {
  if (!devModeAvailable()) {
    return errorResponse(chatError("not_found"));
  }

  await clearDevSession();
  return Response.json({ ok: true });
}
