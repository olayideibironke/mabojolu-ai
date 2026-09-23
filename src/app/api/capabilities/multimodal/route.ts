import {
  inspectLocalMultimodalRuntime,
} from "@/lib/ai/local-multimodal-runtime";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET():
  Promise<Response> {
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
          "no-store",
      },
    },
  );
}
