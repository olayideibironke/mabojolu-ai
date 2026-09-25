import "server-only";

import {
  randomInt,
} from "node:crypto";

import {
  inspectServerEnv,
} from "@/lib/env";

export interface CloudflareGeneratedImage {
  filename:
    string;

  mimeType:
    "image/jpeg";

  base64Data:
    string;

  processor:
    "cloudflare-workers-ai-flux-schnell-v1";
}

export type CloudflareImageGenerationResult =
  | {
      ok:
        true;

      image:
        CloudflareGeneratedImage;
    }
  | {
      ok:
        false;

      code:
        string;

      message:
        string;
    };

interface WorkersAiResponse {
  success?:
    boolean;

  result?: {
    image?:
      string;
  };

  image?:
    string;

  errors?: Array<{
    code?:
      number;

    message?:
      string;
  }>;
}

function generatedImage(
  base64Data:
    string,
): CloudflareImageGenerationResult {
  return {
    ok:
      true,

    image: {
      filename:
        `mabojolu-${Date.now()}.jpg`,

      mimeType:
        "image/jpeg",

      base64Data,

      processor:
        "cloudflare-workers-ai-flux-schnell-v1",
    },
  };
}

export async function generateCloudflareImage(
  input: {
    prompt:
      string;

    timeoutMs?:
      number;
  },
): Promise<CloudflareImageGenerationResult> {
  const envResult =
    inspectServerEnv();

  if (!envResult.ok) {
    return {
      ok:
        false,

      code:
        "invalid_environment",

      message:
        "Mabojolu's server environment is invalid.",
    };
  }

  const accountId =
    envResult.env
      .CLOUDFLARE_ACCOUNT_ID
      ?.trim();

  const apiToken =
    envResult.env
      .CLOUDFLARE_WORKERS_AI_API_TOKEN
      ?.trim();

  if (
    !accountId ||
    !apiToken
  ) {
    return {
      ok:
        false,

      code:
        "workers_ai_not_configured",

      message:
        "Production image generation is not configured.",
    };
  }

  const prompt =
    input.prompt
      .trim();

  if (!prompt) {
    return {
      ok:
        false,

      code:
        "empty_prompt",

      message:
        "An image prompt is required.",
    };
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      input.timeoutMs ??
        120_000,
    );

  try {
    const response =
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
          accountId,
        )}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${apiToken}`,

            Accept:
              "application/json, image/jpeg",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              prompt:
                prompt.slice(
                  0,
                  2048,
                ),

              seed:
                randomInt(
                  1,
                  2_147_483_647,
                ),

              steps:
                4,
            }),

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

    const contentType =
      response.headers
        .get(
          "content-type",
        )
        ?.toLowerCase() ??
      "";

    if (
      response.ok &&
      contentType.startsWith(
        "image/",
      )
    ) {
      const bytes =
        new Uint8Array(
          await response
            .arrayBuffer(),
        );

      if (
        bytes.length ===
        0
      ) {
        return {
          ok:
            false,

          code:
            "workers_ai_empty_response",

          message:
            "Cloudflare Workers AI returned an empty image.",
        };
      }

      return generatedImage(
        Buffer.from(
          bytes,
        ).toString(
          "base64",
        ),
      );
    }

    const rawBody =
      await response
        .text();

    let payload:
      WorkersAiResponse |
      null =
        null;

    try {
      payload =
        rawBody
          ? JSON.parse(
              rawBody,
            ) as
              WorkersAiResponse
          : null;
    } catch {
      payload =
        null;
    }

    const image =
      payload?.result
        ?.image ??
      payload?.image;

    if (
      response.ok &&
      typeof image ===
        "string" &&
      image.length >
        0
    ) {
      return generatedImage(
        image,
      );
    }

    const detail =
      payload?.errors
        ?.map(
          (
            error,
          ) => {
            const message =
              error.message
                ?.trim();

            if (!message) {
              return null;
            }

            return typeof error.code ===
              "number"
              ? `${message} (Cloudflare ${error.code})`
              : message;
          },
        )
        .filter(
          (
            message,
          ): message is string =>
            Boolean(
              message,
            ),
        )
        .join(
          "; ",
        );

    return {
      ok:
        false,

      code:
        response.status ===
          401 ||
        response.status ===
          403
          ? "workers_ai_authentication_failed"
          : "workers_ai_generation_failed",

      message:
        detail ||
        (response.ok
          ? "Cloudflare Workers AI returned no generated image."
          : `Cloudflare Workers AI returned HTTP ${response.status}.`),
    };
  } catch (
    cause
  ) {
    return {
      ok:
        false,

      code:
        "workers_ai_unavailable",

      message:
        cause instanceof
          Error
          ? `Cloudflare Workers AI is unavailable: ${cause.message}`
          : "Cloudflare Workers AI is unavailable.",
    };
  } finally {
    clearTimeout(
      timeout,
    );
  }
}
