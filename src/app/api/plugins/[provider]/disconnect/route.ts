import type {
  NextRequest,
} from "next/server";

import {
  getSession,
} from "@/lib/auth/session";
import {
  getDatabase,
} from "@/lib/database";
import {
  isPluginProviderId,
} from "@/lib/plugins/registry";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    NextRequest,

  context: {
    params:
      Promise<{
        provider:
          string;
      }>;
  },
): Promise<Response> {
  const session =
    await getSession();

  if (
    !session ||
    session.isAnonymous
  ) {
    return Response.redirect(
      new URL(
        "/sign-in",
        request.url,
      ),
      303,
    );
  }

  const {
    provider,
  } =
    await context.params;

  if (
    !isPluginProviderId(
      provider,
    )
  ) {
    return Response.redirect(
      new URL(
        "/plugins?error=unknown-provider",
        request.url,
      ),
      303,
    );
  }

  await getDatabase()
    .deletePluginConnection(
      session.userId,
      provider,
    );

  return Response.redirect(
    new URL(
      `/plugins?disconnected=${provider}`,
      request.url,
    ),
    303,
  );
}
