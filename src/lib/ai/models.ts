/**
 * Central Mabojolu model registry.
 *
 * Every model used by the application is defined here so the chat gateway,
 * context builder, administration tools, and cost calculations share the same
 * configuration.
 */

export type ProviderId =
  | "mock"
  | "ollama"
  | "anthropic";

export interface ModelDefinition {
  id: string;
  providerId: ProviderId;

  /**
   * Exact model identifier passed to the configured AI provider.
   */
  providerModelId: string;

  displayName: string;
  description: string;

  /**
   * Total context budget exposed to Mabojolu.
   */
  contextWindowTokens: number;

  /**
   * Maximum response length allowed for this model.
   */
  maxOutputTokens: number;

  capabilities: {
    streaming: boolean;
    vision: boolean;
    toolUse: boolean;
    reasoning: boolean;
  };

  /**
   * Estimated provider pricing in USD per one million tokens.
   *
   * Local Ollama models have no external per-token charge.
   */
  pricing: {
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
  };

  enabled: boolean;
}

export const MODEL_REGISTRY: readonly ModelDefinition[] = [
  {
    id: "mabojolu-fast",
    providerId: "ollama",
    providerModelId: "qwen3.5:2b-q4_K_M",
    displayName: "Mabojolu Fast",
    description:
      "The quickest local response mode for short questions, simple drafting, everyday assistance, and lightweight image understanding.",
    contextWindowTokens: 16_384,
    maxOutputTokens: 2_048,
    capabilities: {
      streaming: true,
      vision: true,
      toolUse: true,
      reasoning: true,
    },
    pricing: {
      inputPerMillionUsd: 0,
      outputPerMillionUsd: 0,
    },
    enabled: true,
  },
  {
    id: "mabojolu-regular",
    providerId: "ollama",
    providerModelId: "qwen3.5:2b",
    displayName: "Mabojolu Regular",
    description:
      "A balanced local response mode for general conversations, writing, summaries, routine planning, and image understanding.",
    contextWindowTokens: 16_384,
    maxOutputTokens: 3_072,
    capabilities: {
      streaming: true,
      vision: true,
      toolUse: true,
      reasoning: true,
    },
    pricing: {
      inputPerMillionUsd: 0,
      outputPerMillionUsd: 0,
    },
    enabled: true,
  },
  {
    id: "mabojolu-local",
    providerId: "ollama",
    providerModelId: "qwen3.5:4b",
    displayName: "Mabojolu Quality",
    description:
      "The strongest available local response mode for analysis, complex planning, technical work, detailed writing, and richer image understanding.",
    contextWindowTokens: 32_768,
    maxOutputTokens: 4_096,
    capabilities: {
      streaming: true,
      vision: true,
      toolUse: true,
      reasoning: true,
    },
    pricing: {
      inputPerMillionUsd: 0,
      outputPerMillionUsd: 0,
    },
    enabled: true,
  },
  {
    id: "mabojolu-core",
    providerId: "anthropic",
    providerModelId: "claude-opus-5",
    displayName: "Mabojolu Core",
    description:
      "Deep cloud intelligence reserved for future complex analysis, planning, and professional work.",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    capabilities: {
      streaming: true,
      vision: true,
      toolUse: true,
      reasoning: true,
    },
    pricing: {
      inputPerMillionUsd: 5,
      outputPerMillionUsd: 25,
    },
    enabled: true,
  },
  {
    id: "mabojolu-swift",
    providerId: "anthropic",
    providerModelId: "claude-sonnet-5",
    displayName: "Mabojolu Swift",
    description:
      "Balanced cloud intelligence reserved for future everyday professional work.",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    capabilities: {
      streaming: true,
      vision: true,
      toolUse: true,
      reasoning: true,
    },
    pricing: {
      inputPerMillionUsd: 3,
      outputPerMillionUsd: 15,
    },
    enabled: true,
  },
  {
    id: "mabojolu-mock",
    providerId: "mock",
    providerModelId: "mock-1",
    displayName: "Mabojolu Development Mock",
    description:
      "Deterministic responder used for local development and automated testing.",
    contextWindowTokens: 200_000,
    maxOutputTokens: 4_096,
    capabilities: {
      streaming: true,
      vision: false,
      toolUse: false,
      reasoning: false,
    },
    pricing: {
      inputPerMillionUsd: 0,
      outputPerMillionUsd: 0,
    },
    enabled: true,
  },
] as const;

export function findModel(
  id: string,
): ModelDefinition | undefined {
  return MODEL_REGISTRY.find(
    (model) => model.id === id,
  );
}

export function modelsForProvider(
  providerId: ProviderId,
): readonly ModelDefinition[] {
  return MODEL_REGISTRY.filter(
    (model) =>
      model.providerId === providerId &&
      model.enabled,
  );
}

/**
 * Returns the first enabled model registered for the requested provider.
 */
export function defaultModelFor(
  providerId: ProviderId,
): ModelDefinition {
  const model =
    modelsForProvider(providerId)[0];

  if (!model) {
    throw new Error(
      `No enabled model is registered for provider "${providerId}".`,
    );
  }

  return model;
}

/**
 * Estimates the external provider cost for a completed generation.
 */
export function estimateCostUsd(
  model: ModelDefinition,
  usage: {
    inputTokens: number;
    outputTokens: number;
  },
): number {
  const inputCost =
    (usage.inputTokens / 1_000_000) *
    model.pricing.inputPerMillionUsd;

  const outputCost =
    (usage.outputTokens / 1_000_000) *
    model.pricing.outputPerMillionUsd;

  return inputCost + outputCost;
}

/**
 * Conservative token estimate used for context budgeting.
 *
 * This is not a provider-specific tokenizer. The estimate intentionally leaves
 * additional safety room before the model context limit is reached.
 */
export function estimateTokens(
  text: string,
): number {
  return Math.ceil(text.length / 3.5);
}