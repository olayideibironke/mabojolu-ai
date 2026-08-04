/**
 * Model registry.
 *
 * Capability metadata, context limits, and pricing live here rather than being
 * scattered through call sites. The admin cost view, context builder, and
 * provider adapters therefore read the same configuration.
 *
 * Pricing is USD per million tokens and is used only for internal estimates.
 * Local Ollama models have no per-token provider charge, although they still
 * consume the user's computer resources.
 */

export type ProviderId =
  | "mock"
  | "ollama"
  | "anthropic";

export interface ModelDefinition {
  id: string;
  providerId: ProviderId;

  /** Identifier sent directly to the configured provider. */
  providerModelId: string;

  displayName: string;
  description: string;

  /** Total context budget available to the application. */
  contextWindowTokens: number;

  /** Maximum generated tokens allowed by Mabojolu for this model. */
  maxOutputTokens: number;

  capabilities: {
    streaming: boolean;
    vision: boolean;
    toolUse: boolean;

    /**
     * Whether the underlying model can perform internal reasoning.
     * Mabojolu never exposes raw hidden reasoning traces.
     */
    reasoning: boolean;
  };

  pricing: {
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
  };

  /** Disabled models remain visible to administrators but cannot serve chat. */
  enabled: boolean;
}

export const MODEL_REGISTRY: readonly ModelDefinition[] = [
  {
    id: "mabojolu-fast",
    providerId: "ollama",
    providerModelId: "qwen3.5:2b-q4_K_M",
    displayName: "Mabojolu Fast",
    description:
      "Faster local intelligence for everyday questions, drafting, and quick assistance.",
    contextWindowTokens: 16_384,
    maxOutputTokens: 4_096,
    capabilities: {
      streaming: true,
      vision: false,
      toolUse: false,
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
      "Higher-quality local intelligence for analysis, detailed writing, planning, and technical work.",
    contextWindowTokens: 32_768,
    maxOutputTokens: 8_192,
    capabilities: {
      streaming: true,

      /*
       * The current Mabojolu Ollama adapter sends text conversations only.
       * This can become true after image attachments are connected to the
       * provider request format and tested.
       */
      vision: false,

      /*
       * Tool execution remains disabled until the permission-based Mabojolu
       * Agent system is implemented.
       */
      toolUse: false,

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
      "Deep cloud intelligence reserved for complex analysis, planning, and professional work.",
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
      "Balanced cloud intelligence reserved for everyday professional work.",
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
      "Deterministic responder used for development and automated testing.",
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
 * Return the first enabled model registered for a provider.
 *
 * A missing model is an application configuration error rather than a
 * recoverable user condition.
 */
export function defaultModelFor(
  providerId: ProviderId,
): ModelDefinition {
  const model = modelsForProvider(providerId)[0];

  if (!model) {
    throw new Error(
      `No enabled model is registered for provider "${providerId}".`,
    );
  }

  return model;
}

/** Estimate the provider charge for one completed generation. */
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
 * This is not a provider tokenizer. It intentionally overestimates so the
 * application is less likely to exceed a model's actual context limit.
 */
export function estimateTokens(
  text: string,
): number {
  return Math.ceil(text.length / 3.5);
}