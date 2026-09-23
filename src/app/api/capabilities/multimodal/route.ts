import {
  chatError,
} from "@/lib/ai/errors";
import {
  inspectLocalMultimodalRuntime,
} from "@/lib/ai/local-multimodal-runtime";
import {
  errorResponse,
} from "@/lib/ai/stream";
import {
  getSession,
} from "@/lib/auth/session";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET():
  Promise<Response> {
  const session =
    await getSession();

  if (!session) {
    return errorResponse(
      chatError(
        "unauthorized",
      ),
    );
  }

  const status =
    await inspectLocalMultimodalRuntime();

  return Response.json(
    {
      capabilities:
        status.capabilities,

      components:
        status.components.map(
          (
            component,
          ) => ({
            id:
              component.id,

            available:
              component.available,

            detail:
              component.detail,
          }),
        ),
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store",
      },
    },
  );
}
