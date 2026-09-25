import "server-only";

import {
  generateCloudflareImage,
} from "@/lib/ai/cloudflare-image-generation";

import {
  generateLocalImage,
} from "@/lib/ai/local-image-generation";

export interface GeneratedImage {
  filename:
    string;

  mimeType:
    "image/png" |
    "image/jpeg" |
    "image/webp";

  base64Data:
    string;

  processor:
    "comfyui-local-v1" |
    "cloudflare-workers-ai-flux-schnell-v1" |
    "cloudflare-workers-ai-lucid-origin-v1" |
    "cloudflare-workers-ai-phoenix-v1";
}

export type ImageGenerationResult =
  | {
      ok:
        true;

      image:
        GeneratedImage;
    }
  | {
      ok:
        false;

      code:
        string;

      message:
        string;
    };

export async function generateImage(
  input: {
    prompt:
      string;

    negativePrompt?:
      string;

    timeoutMs?:
      number;
  },
): Promise<ImageGenerationResult> {
  if (
    process.env.NODE_ENV ===
      "production"
  ) {
    return generateCloudflareImage({
      prompt:
        input.prompt,

      timeoutMs:
        input.timeoutMs,
    });
  }

  return generateLocalImage(
    input,
  );
}
