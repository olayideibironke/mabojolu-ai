import type { UsageRecord } from "@/types/chat";

import type { ModelDefinition } from "./models";

/**
 * Provider-independent gateway contract.
 *
 * Mabojolu depends on this interface rather than on an individual provider's
 * SDK or API shape. Adding or replacing a provider therefore does not require
 * changing the route handler or chat interface.
 */

/**
 * Image prepared for an AI provider.
 *
 * The browser data URL prefix is removed during context construction. Providers
 * receive only validated base64 image data plus its MIME type.
 */
export interface NormalizedImage {
  /** Original filename retained for debugging and future UI metadata. */
  name: string;

  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  /** Base64 image content without the data URL prefix. */
  base64Data: string;
}

/**
 * A normalized conversation message ready for any configured provider.
 *
 * Images are optional because ordinary text conversations should remain small.
 */
export interface NormalizedMessage {
  role: "user" | "assistant";
  content: string;

  /**
   * Vision attachments associated with this user turn.
   *
   * Assistant messages should not contain images in the current Mabojolu
   * implementation.
   */
  images?: NormalizedImage[];
}

export interface GenerationRequest {
  model: ModelDefinition;

  /** Server-controlled instructions. Never supplied by the browser. */
  systemPrompt: string;

  messages: NormalizedMessage[];

  maxOutputTokens: number;

  /**
   * Cancels the provider request.
   *
   * This is connected to the user pressing stop, navigating away, or closing
   * the browser request.
   */
  signal: AbortSignal;

  /**
   * Deduplication key used so a retried request is recognized as the same
   * logical generation instead of silently creating another one.
   */
  idempotencyKey?: string;
}

export type GenerationChunk =
  | {
      type: "text";
      text: string;
    }
  | {
      /**
       * Progress status only.
       *
       * Raw private reasoning is never forwarded to the browser.
       */
      type: "progress";
      label: string;
    }
  | {
      type: "finish";

      finishReason:
        | "end_turn"
        | "max_tokens"
        | "aborted"
        | "refusal";

      usage?: UsageRecord;
    };

export interface AiProvider {
  readonly id: string;

  /**
   * Whether this provider can currently serve requests.
   *
   * This is checked before generation begins so missing configuration produces
   * a clear Mabojolu error instead of an unclear provider failure.
   */
  isConfigured(): boolean;

  /**
   * Stream one generation.
   *
   * Provider implementations must normalize failures into Mabojolu ChatError
   * instances and must never expose credentials or internal provider details.
   */
  stream(
    request: GenerationRequest,
  ): AsyncIterable<GenerationChunk>;
}