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

  errors?: Array<{
    message?:
      string;
  }>;
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
      .CLOUDFLARE_ACCOUNT_ID;

  const apiToken =
    envResult.env
      .CLOUDFLARE_WORKERS_AI_API_TOKEN;

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

    let payload:
      WorkersAiResponse;

    try {
      payload =
        await response
          .json() as
          WorkersAiResponse;
    } catch {
      return {
        ok:
          false,

        code:
          "workers_ai_invalid_response",

        message:
          "Cloudflare Workers AI returned an unreadable response.",
      };
    }

    const image =
      payload.result
        ?.image;

    if (
      !response.ok ||
      payload.success ===
        false ||
      typeof image !==
        "string" ||
      !image
    ) {
      const detail =
        payload.errors
          ?.map(
            (
              error,
            ) =>
              error.message,
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
          "workers_ai_generation_failed",

        message:
          detail ||
          `Cloudflare Workers AI returned HTTP ${response.status}.`,
      };
    }

    return {
      ok:
        true,

      image: {
        filename:
          `mabojolu-${Date.now()}.jpg`,

        mimeType:
          "image/jpeg",

        base64Data:
          image,

        processor:
          "cloudflare-workers-ai-flux-schnell-v1",
      },
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
