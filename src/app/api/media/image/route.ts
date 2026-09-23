import type {
  NextRequest,
} from "next/server";

import {
  chatError,
  logChatError,
  normalizeError,
} from "@/lib/ai/errors";
import {
  generateLocalImage,
} from "@/lib/ai/local-image-generation";
import {
  errorResponse,
} from "@/lib/ai/stream";
import {
  getSession,
} from "@/lib/auth/session";
import {
  getRateLimiter,
  rateLimitIdentity,
} from "@/lib/security/rate-limit";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    NextRequest,
): Promise<Response> {
  try {
    const session =
      await getSession();

    if (!session) {
      return errorResponse(
        chatError(
          "unauthorized",
        ),
      );
    }

    const limit =
      getRateLimiter({
        name:
          "local-image-generation",

        max:
          6,

        windowMs:
          60_000,
      }).check(
        rateLimitIdentity({
          userId:
            session.userId,

          headers:
            request.headers,
        }),
      );

    if (!limit.allowed) {
      return errorResponse(
        chatError(
          "rate_limited",
          {
            message:
              "Too many image-generation requests. Please wait a moment and try again.",

            retryAfterSeconds:
              limit
                .retryAfterSeconds,
          },
        ),
      );
    }

    let raw:
      unknown;

    try {
      raw =
        await request.json();
    } catch {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "That image-generation request could not be read.",
          },
        ),
      );
    }

    if (
      typeof raw !==
        "object" ||
      raw ===
        null ||
      !(
        "prompt" in
        raw
      ) ||
      typeof (
        raw as {
          prompt?:
            unknown;
        }
      ).prompt !==
        "string"
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "An image prompt is required.",
          },
        ),
      );
    }

    const prompt =
      (
        raw as {
          prompt:
            string;

          negativePrompt?:
            unknown;
        }
      )
        .prompt
        .trim();

    const negativePrompt =
      (
        raw as {
          negativePrompt?:
            unknown;
        }
      )
        .negativePrompt;

    if (
      prompt.length ===
        0 ||
      prompt.length >
        4_000
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "The image prompt must contain between 1 and 4,000 characters.",
          },
        ),
      );
    }

    if (
      negativePrompt !==
        undefined &&
      typeof negativePrompt !==
        "string"
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "The negative image prompt must be text.",
          },
        ),
      );
    }

    const generated =
      await generateLocalImage(
        {
          prompt,

          ...(typeof negativePrompt ===
            "string" &&
          negativePrompt.trim()
            .length >
            0
            ? {
                negativePrompt:
                  negativePrompt
                    .trim(),
              }
            : {}),
        },
      );

    if (!generated.ok) {
      return errorResponse(
        chatError(
          "provider_unavailable",
          {
            message:
              generated.message,
          },
        ),
      );
    }

    const dataUrl =
      `data:${generated.image.mimeType};base64,${generated.image.base64Data}`;

    return Response.json(
      {
        image: {
          filename:
            generated.image
              .filename,

          mimeType:
            generated.image
              .mimeType,

          dataUrl,

          processor:
            generated.image
              .processor,
        },
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch (cause) {
    const error =
      normalizeError(
        cause,
      );

    logChatError(
      error,
      {
        route:
          "POST /api/media/image",
      },
    );

    return errorResponse(
      error,
    );
  }
}
