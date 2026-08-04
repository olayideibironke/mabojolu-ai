import "server-only";

import { inspectServerEnv } from "@/lib/env";
import { getSystemPrompt } from "@/prompts/system";
import type { ChatMessage } from "@/types/chat";

import { buildContext } from "./context";
import { chatError } from "./errors";
import {
  defaultModelFor,
  findModel,
  type ModelDefinition,
  type ProviderId,
} from "./models";
import type { AiProvider, GenerationChunk } from "./provider";
import { AnthropicProvider } from "./providers/anthropic";
import { MockProvider } from "./providers/mock";

/**
 * The model gateway.
 *
 * Single place where a provider is chosen and a request is assembled. Route
 * handlers depend on this rather than on any provider SDK, which is what lets a
 * provider change without touching the product.
 */

const providerCache = new Map<ProviderId, AiProvider>();

function getProvider(providerId: ProviderId): AiProvider {
  const cached = providerCache.get(providerId);
  if (cached) {
    return cached;
  }

  const envResult = inspectServerEnv();
  if (!envResult.ok) {
    // Surfaced as a configuration problem, with details logged server-side
    // only so environment contents never reach the browser.
    console.error(
      "[mabojolu] invalid environment",
      envResult.issues.join("; "),
    );
    throw chatError("provider_not_configured", {
      message:
        "Mabojolu is not configured correctly. Check the server environment variables.",
    });
  }

  const env = envResult.env;

  const provider: AiProvider =
    providerId === "anthropic"
      ? new AnthropicProvider({
          apiKey: env.ANTHROPIC_API_KEY,
          timeoutMs: env.MABOJOLU_REQUEST_TIMEOUT_MS,
        })
      : new MockProvider({
          chunkDelayMs: env.NODE_ENV === "test" ? 0 : 18,
        });

  providerCache.set(providerId, provider);
  return provider;
}

/** Resolve the model to use, honoring an explicit request then configuration. */
export function resolveModel(requestedModelId?: string): ModelDefinition {
  const envResult = inspectServerEnv();
  const providerId: ProviderId = envResult.ok ? envResult.env.AI_PROVIDER : "mock";

  const candidateId =
    requestedModelId ??
    (envResult.ok ? envResult.env.MABOJOLU_DEFAULT_MODEL : undefined);

  if (candidateId) {
    const model = findModel(candidateId);

    if (!model || !model.enabled) {
      throw chatError("invalid_request", {
        message: "That model is not available.",
      });
    }

    // A model belonging to another provider cannot be served by the configured
    // one. Fail clearly instead of silently substituting a different model.
    if (model.providerId !== providerId) {
      throw chatError("invalid_request", {
        message: "That model is not available in this environment.",
      });
    }

    return model;
  }

  return defaultModelFor(providerId);
}

export interface GatewayRequest {
  messages: ChatMessage[];
  modelId?: string;
  signal: AbortSignal;
  idempotencyKey?: string;
  promptVersion?: string;
}

export interface GatewayStream {
  model: ModelDefinition;
  promptVersion: string;
  estimatedInputTokens: number;
  droppedMessages: number;
  chunks: AsyncIterable<GenerationChunk>;
}

/**
 * Assemble and start a generation.
 *
 * Throws `ChatError` before any streaming begins for configuration and
 * validation problems, so the caller can respond with a proper status code
 * rather than an error embedded mid-stream.
 */
export function startGeneration(request: GatewayRequest): GatewayStream {
  const envResult = inspectServerEnv();
  if (!envResult.ok) {
    console.error("[mabojolu] invalid environment", envResult.issues.join("; "));
    throw chatError("provider_not_configured", {
      message:
        "Mabojolu is not configured correctly. Check the server environment variables.",
    });
  }

  const env = envResult.env;
  const model = resolveModel(request.modelId);
  const provider = getProvider(model.providerId);

  if (!provider.isConfigured()) {
    throw chatError("provider_not_configured");
  }

  const prompt = getSystemPrompt(request.promptVersion);
  const maxOutputTokens = Math.min(
    env.MABOJOLU_MAX_OUTPUT_TOKENS,
    model.maxOutputTokens,
  );

  const context = buildContext({
    messages: request.messages,
    systemPrompt: prompt.content,
    model,
    maxOutputTokens,
    contextTokenBudget: env.MABOJOLU_CONTEXT_TOKEN_BUDGET,
  });

  return {
    model,
    promptVersion: prompt.version,
    estimatedInputTokens: context.estimatedInputTokens,
    droppedMessages: context.droppedMessages,
    chunks: provider.stream({
      model,
      systemPrompt: prompt.content,
      messages: context.messages,
      maxOutputTokens,
      signal: request.signal,
      idempotencyKey: request.idempotencyKey,
    }),
  };
}

/** Test-only: clear memoized providers so env changes take effect. */
export function resetProviderCache(): void {
  providerCache.clear();
}
