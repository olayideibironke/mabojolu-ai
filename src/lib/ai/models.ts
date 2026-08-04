/**
 * Model registry.
 *
 * Capability metadata, context limits, and pricing live here rather than being
 * scattered through call sites, so the admin cost view, the context builder,
 * and the provider adapters all read the same numbers.
 *
 * Pricing is USD per million tokens and is used only for internal estimates.
 * Provider pricing changes without notice, so treat these as configuration to
 * review rather than as a billing source of truth.
 */

export type ProviderId = "mock" | "anthropic";

export interface ModelDefinition {
  id: string;
  providerId: ProviderId;
  /** Identifier sent to the provider, which may differ from our public id. */
  providerModelId: string;
  displayName: string;
  description: string;
  /** Total context window in tokens. */
  contextWindowTokens: number;
  /** Provider-enforced ceiling on generated tokens. */
  maxOutputTokens: number;
  capabilities: {
    streaming: boolean;
    vision: boolean;
    toolUse: boolean;
    /** Server-side reasoning. We surface progress, never raw reasoning. */
    reasoning: boolean;
  };
  pricing: {
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
  };
  /** Disabled models stay visible to admins but cannot serve requests. */
  enabled: boolean;
}

export const MODEL_REGISTRY: readonly ModelDefinition[] = [
  {
    id: "mabojolu-core",
    providerId: "anthropic",
    providerModelId: "claude-opus-5",
    displayName: "Mabojolu Core",
    description: "Deep reasoning for analysis, planning, and complex work.",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    capabilities: {
      streaming: true,
      vision: true,
      toolUse: true,
      reasoning: true,
    },
    pricing: { inputPerMillionUsd: 5, outputPerMillionUsd: 25 },
    enabled: true,
  },
  {
    id: "mabojolu-swift",
    providerId: "anthropic",
    providerModelId: "claude-sonnet-5",
    displayName: "Mabojolu Swift",
    description: "Balanced speed and capability for everyday work.",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    capabilities: {
      streaming: true,
      vision: true,
      toolUse: true,
      reasoning: true,
    },
    pricing: { inputPerMillionUsd: 3, outputPerMillionUsd: 15 },
    enabled: true,
  },
  {
    id: "mabojolu-mock",
    providerId: "mock",
    providerModelId: "mock-1",
    displayName: "Mabojolu Development Mock",
    description:
      "Deterministic local responder used for development and automated tests.",
    contextWindowTokens: 200_000,
    maxOutputTokens: 4_096,
    capabilities: {
      streaming: true,
      vision: false,
      toolUse: false,
      reasoning: false,
    },
    pricing: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
    enabled: true,
  },
] as const;

export function findModel(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((model) => model.id === id);
}

export function modelsForProvider(
  providerId: ProviderId,
): readonly ModelDefinition[] {
  return MODEL_REGISTRY.filter(
    (model) => model.providerId === providerId && model.enabled,
  );
}

/**
 * Default model for a provider.
 *
 * Throws only if a provider has no enabled model, which is a configuration bug
 * rather than a runtime condition.
 */
export function defaultModelFor(providerId: ProviderId): ModelDefinition {
  const model = modelsForProvider(providerId)[0];

  if (!model) {
    throw new Error(`No enabled model is registered for provider "${providerId}".`);
  }

  return model;
}

/** Estimated USD cost of one generation, for admin reporting. */
export function estimateCostUsd(
  model: ModelDefinition,
  usage: { inputTokens: number; outputTokens: number },
): number {
  const input = (usage.inputTokens / 1_000_000) * model.pricing.inputPerMillionUsd;
  const output =
    (usage.outputTokens / 1_000_000) * model.pricing.outputPerMillionUsd;
  return input + output;
}

/**
 * Rough token estimate used for context budgeting.
 *
 * Approximation, not a substitute for a real tokenizer: it is only used to
 * decide how much history fits, and it deliberately over-estimates so the
 * budget is conservative rather than exceeded.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
