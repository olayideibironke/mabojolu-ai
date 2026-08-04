import type { UsageRecord } from "@/types/chat";
import type { ModelDefinition } from "./models";

/**
 * Provider-independent gateway contract.
 *
 * The chat product depends on this interface only. Adding a provider means
 * writing an adapter, not touching route handlers or UI, which is what keeps
 * the product portable.
 */

/** A message after normalization, ready for any provider. */
export interface NormalizedMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerationRequest {
  model: ModelDefinition;
  /** Server-controlled instructions. Never supplied by the browser. */
  systemPrompt: string;
  messages: NormalizedMessage[];
  maxOutputTokens: number;
  /**
   * Cancels the provider request. Wired to the client disconnecting or to the
   * user pressing stop, so an abandoned generation stops being billed.
   */
  signal: AbortSignal;
  /**
   * Deduplication key. Lets a retried request be recognized rather than
   * silently producing a second billable generation.
   */
  idempotencyKey?: string;
}

export type GenerationChunk =
  | { type: "text"; text: string }
  /** Progress signal only. Raw model reasoning is never forwarded. */
  | { type: "progress"; label: string }
  | {
      type: "finish";
      finishReason: "end_turn" | "max_tokens" | "aborted" | "refusal";
      usage?: UsageRecord;
    };

export interface AiProvider {
  readonly id: string;
  /**
   * Whether this provider can serve traffic right now.
   *
   * Checked before a request is attempted so a missing credential produces a
   * clear configuration error rather than a provider exception.
   */
  isConfigured(): boolean;
  /**
   * Stream a generation.
   *
   * Implementations must throw `ChatError` for every failure and must not leak
   * provider-specific detail into the thrown message.
   */
  stream(request: GenerationRequest): AsyncIterable<GenerationChunk>;
}
