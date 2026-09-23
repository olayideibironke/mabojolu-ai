import "server-only";

import {
  readFile,
} from "node:fs/promises";
import {
  randomInt,
} from "node:crypto";

import {
  inspectServerEnv,
} from "@/lib/env";

export interface LocalGeneratedImage {
  filename:
    string;

  mimeType:
    "image/png" |
    "image/jpeg" |
    "image/webp";

  base64Data:
    string;

  processor:
    "comfyui-local-v1";
}

export type LocalImageGenerationResult =
  | {
      ok:
        true;

      image:
        LocalGeneratedImage;
    }
  | {
      ok:
        false;

      code:
        string;

      message:
        string;
    };

interface ComfyImageDescriptor {
  filename?:
    string;

  subfolder?:
    string;

  type?:
    string;
}

interface ComfyHistoryEntry {
  outputs?:
    Record<
      string,
      {
        images?:
          ComfyImageDescriptor[];
      }
    >;
}

function isLoopbackUrl(
  value:
    string,
): boolean {
  try {
    const url =
      new URL(
        value,
      );

    return (
      (
        url.protocol ===
          "http:" ||
        url.protocol ===
          "https:"
      ) &&
      (
        url.hostname ===
          "127.0.0.1" ||
        url.hostname ===
          "localhost" ||
        url.hostname ===
          "::1" ||
        url.hostname ===
          "[::1]"
      )
    );
  } catch {
    return false;
  }
}

function replaceWorkflowPlaceholders(
  value:
    unknown,
  variables:
    Readonly<
      Record<
        string,
        string
      >
    >,
): unknown {
  if (
    typeof value ===
      "string"
  ) {
    if (
      value ===
        "{{SEED}}"
    ) {
      const seed =
        Number(
          variables.SEED,
        );

      return Number.isFinite(
        seed,
      )
        ? seed
        : 1;
    }

    let output =
      value;

    for (
      const [
        key,
        replacement,
      ] of
        Object.entries(
          variables,
        )
    ) {
      output =
        output.replaceAll(
          `{{${key}}}`,
          replacement,
        );
    }

    return output;
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      (
        item,
      ) =>
        replaceWorkflowPlaceholders(
          item,
          variables,
        ),
    );
  }

  if (
    typeof value ===
      "object" &&
    value !==
      null
  ) {
    return Object.fromEntries(
      Object.entries(
        value,
      ).map(
        (
          [
            key,
            item,
          ],
        ) => [
          key,
          replaceWorkflowPlaceholders(
            item,
            variables,
          ),
        ],
      ),
    );
  }

  return value;
}

function mimeTypeForFilename(
  filename:
    string,
):
  LocalGeneratedImage[
    "mimeType"
  ] {
  const lower =
    filename.toLowerCase();

  if (
    lower.endsWith(
      ".jpg",
    ) ||
    lower.endsWith(
      ".jpeg",
    )
  ) {
    return "image/jpeg";
  }

  if (
    lower.endsWith(
      ".webp",
    )
  ) {
    return "image/webp";
  }

  return "image/png";
}

async function readWorkflow(
  workflowPath:
    string,
  prompt:
    string,
  negativePrompt:
    string,
): Promise<unknown> {
  const raw =
    await readFile(
      workflowPath,
      "utf8",
    );

  const parsed:
    unknown =
      JSON.parse(
        raw,
      );

  return replaceWorkflowPlaceholders(
    parsed,
    {
      PROMPT:
        prompt,

      NEGATIVE_PROMPT:
        negativePrompt,

      SEED:
        String(
          randomInt(
            1,
            2_147_483_647,
          ),
        ),
    },
  );
}

async function fetchJson(
  url:
    string,
  init?:
    RequestInit,
): Promise<unknown> {
  const response =
    await fetch(
      url,
      {
        ...init,

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      `Local ComfyUI returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

function findFirstImage(
  entry:
    ComfyHistoryEntry,
): ComfyImageDescriptor | undefined {
  for (
    const output of
      Object.values(
        entry.outputs ??
        {},
      )
  ) {
    const image =
      output.images
        ?.find(
          (
            candidate,
          ) =>
            typeof candidate
              .filename ===
            "string",
        );

    if (image) {
      return image;
    }
  }

  return undefined;
}

async function waitForImage(
  baseUrl:
    string,
  promptId:
    string,
  timeoutMs:
    number,
): Promise<ComfyImageDescriptor | undefined> {
  const started =
    Date.now();

  while (
    Date.now() -
      started <
    timeoutMs
  ) {
    const history =
      await fetchJson(
        new URL(
          `/history/${encodeURIComponent(
            promptId,
          )}`,
          baseUrl,
        ).toString(),
      ) as
        Record<
          string,
          ComfyHistoryEntry
        >;

    const entry =
      history[
        promptId
      ];

    if (entry) {
      const image =
        findFirstImage(
          entry,
        );

      if (image) {
        return image;
      }
    }

    await new Promise(
      (
        resolve,
      ) =>
        setTimeout(
          resolve,
          500,
        ),
    );
  }

  return undefined;
}

export async function generateLocalImage(
  input: {
    prompt:
      string;

    negativePrompt?:
      string;

    timeoutMs?:
      number;
  },
): Promise<LocalImageGenerationResult> {
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

  const env =
    envResult.env;

  if (
    !env
      .MABOJOLU_COMFYUI_WORKFLOW_PATH
  ) {
    return {
      ok:
        false,

      code:
        "workflow_not_configured",

      message:
        "Local image generation requires MABOJOLU_COMFYUI_WORKFLOW_PATH.",
    };
  }

  if (
    !isLoopbackUrl(
      env
        .MABOJOLU_COMFYUI_BASE_URL,
    )
  ) {
    return {
      ok:
        false,

      code:
        "nonlocal_comfyui_rejected",

      message:
        "Mabojolu only permits the configured ComfyUI image generator on the local machine.",
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

  let workflow:
    unknown;

  try {
    workflow =
      await readWorkflow(
        env
          .MABOJOLU_COMFYUI_WORKFLOW_PATH,
        prompt,
        input
          .negativePrompt
          ?.trim() ??
          "",
      );
  } catch (
    cause
  ) {
    return {
      ok:
        false,

      code:
        "workflow_invalid",

      message:
        cause instanceof
          Error
          ? `The local ComfyUI workflow could not be loaded: ${cause.message}`
          : "The local ComfyUI workflow could not be loaded.",
    };
  }

  try {
    const queued =
      await fetchJson(
        new URL(
          "/prompt",
          env
            .MABOJOLU_COMFYUI_BASE_URL,
        ).toString(),
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              prompt:
                workflow,
            }),
        },
      ) as {
        prompt_id?:
          string;
      };

    if (
      typeof queued
        .prompt_id !==
        "string" ||
      !queued.prompt_id
    ) {
      return {
        ok:
          false,

        code:
          "queue_failed",

        message:
          "Local ComfyUI did not return a prompt identifier.",
      };
    }

    const image =
      await waitForImage(
        env
          .MABOJOLU_COMFYUI_BASE_URL,
        queued.prompt_id,
        input.timeoutMs ??
          120_000,
      );

    if (
      !image ||
      typeof image
        .filename !==
        "string"
    ) {
      return {
        ok:
          false,

        code:
          "generation_timeout",

        message:
          "Local image generation did not produce an image before the timeout.",
      };
    }

    const viewUrl =
      new URL(
        "/view",
        env
          .MABOJOLU_COMFYUI_BASE_URL,
      );

    viewUrl.searchParams.set(
      "filename",
      image.filename,
    );

    if (
      image.subfolder
    ) {
      viewUrl.searchParams.set(
        "subfolder",
        image.subfolder,
      );
    }

    if (
      image.type
    ) {
      viewUrl.searchParams.set(
        "type",
        image.type,
      );
    }

    const response =
      await fetch(
        viewUrl.toString(),
        {
          cache:
            "no-store",
        },
      );

    if (!response.ok) {
      return {
        ok:
          false,

        code:
          "generated_image_unavailable",

        message:
          "Local ComfyUI generated an image but Mabojolu could not retrieve it.",
      };
    }

    const bytes =
      new Uint8Array(
        await response
          .arrayBuffer(),
      );

    return {
      ok:
        true,

      image: {
        filename:
          image.filename,

        mimeType:
          mimeTypeForFilename(
            image.filename,
          ),

        base64Data:
          Buffer.from(
            bytes,
          ).toString(
            "base64",
          ),

        processor:
          "comfyui-local-v1",
      },
    };
  } catch (
    cause
  ) {
    return {
      ok:
        false,

      code:
        "comfyui_unavailable",

      message:
        cause instanceof
          Error
          ? `Local ComfyUI is unavailable: ${cause.message}`
          : "Local ComfyUI is unavailable.",
    };
  }
}
