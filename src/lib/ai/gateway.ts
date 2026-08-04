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
import type {
  AiProvider,
  GenerationChunk,
} from "./provider";
import { AnthropicProvider } from "./providers/anthropic";
import { MockProvider } from "./providers/mock";
import { OllamaProvider } from "./providers/ollama";

/**
 * Mabojolu model gateway.
 *
 * This is the single place where an AI provider is selected and configured.
 * Routes and UI components remain independent of Anthropic, Ollama, or mock
 * implementation details.
 */

const providerCache = new Map<ProviderId, AiProvider>();

function getProvider(providerId: ProviderId): AiProvider {
  const cachedProvider = providerCache.get(providerId);

  if (cachedProvider) {
    return cachedProvider;
  }

  const envResult = inspectServerEnv();

  if (!envResult.ok) {
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

  let provider: AiProvider;

  switch (providerId) {
    case "anthropic":
      provider = new AnthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        timeoutMs: env.MABOJOLU_REQUEST_TIMEOUT_MS,
      });
      break;

    case "ollama":
      provider = new OllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL,
        timeoutMs: env.MABOJOLU_REQUEST_TIMEOUT_MS,
        keepAlive: env.OLLAMA_KEEP_ALIVE,
      });
      break;

    case "mock":
      provider = new MockProvider({
        chunkDelayMs:
          env.NODE_ENV === "test" ? 0 : 18,
      });
      break;

    default: {
      const unsupportedProvider: never = providerId;

      throw chatError("provider_not_configured", {
        message:
          "The selected Mabojolu AI provider is not supported.",
        cause: new Error(
          `Unsupported provider: ${unsupportedProvider}`,
        ),
      });
    }
  }

  providerCache.set(providerId, provider);

  return provider;
}

/**
 * Resolve the model for the current environment.
 *
 * An explicitly requested model must belong to the configured provider.
 * Mabojolu never silently substitutes a cloud model for a local model or the
 * other way around.
 */
export function resolveModel(
  requestedModelId?: string,
): ModelDefinition {
  const envResult = inspectServerEnv();

  const providerId: ProviderId = envResult.ok
    ? envResult.env.AI_PROVIDER
    : "mock";

  const candidateId =
    requestedModelId ??
    (envResult.ok
      ? envResult.env.MABOJOLU_DEFAULT_MODEL
      : undefined);

  if (candidateId) {
    const model = findModel(candidateId);

    if (!model || !model.enabled) {
      throw chatError("invalid_request", {
        message: "That model is not available.",
      });
    }

    if (model.providerId !== providerId) {
      throw chatError("invalid_request", {
        message:
          "That model is not available in this environment.",
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
 * Assemble and start one AI generation.
 *
 * Configuration and validation failures occur before streaming starts, allowing
 * the chat route to return a clear HTTP response instead of a broken stream.
 */
export function startGeneration(
  request: GatewayRequest,
): GatewayStream {
  const envResult = inspectServerEnv();

  if (!envResult.ok) {
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
  const model = resolveModel(request.modelId);
  const provider = getProvider(model.providerId);

  if (!provider.isConfigured()) {
    throw chatError("provider_not_configured");
  }

  const prompt = getSystemPrompt(
    request.promptVersion,
  );

  const maxOutputTokens = Math.min(
    env.MABOJOLU_MAX_OUTPUT_TOKENS,
    model.maxOutputTokens,
  );

  const context = buildContext({
    messages: request.messages,
    systemPrompt: prompt.content,
    model,
    maxOutputTokens,
    contextTokenBudget:
      env.MABOJOLU_CONTEXT_TOKEN_BUDGET,
  });

  return {
    model,
    promptVersion: prompt.version,
    estimatedInputTokens:
      context.estimatedInputTokens,
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

/**
 * Test-only escape hatch.
 *
 * Environment-dependent provider instances are cached between requests, so
 * automated tests must clear this map when changing environment variables.
 */
export function resetProviderCache(): void {
  providerCache.clear();
}