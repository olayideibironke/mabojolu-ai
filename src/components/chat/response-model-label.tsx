/**
 * Displays the model that produced an assistant response.
 *
 * The API may return either Mabojolu's internal model id or Ollama's provider
 * model id. Both formats are normalized here so the interface always presents
 * the friendly Mabojolu product name.
 */

interface ResponseModelLabelProps {
  model?: string;
  isStreaming?: boolean;
}

interface ResolvedModel {
  label: string;
  description: string;
}

const FAST_MODEL_IDS = new Set([
  "mabojolu-fast",
  "qwen3.5:2b-q4_k_m",
  "mabojolu fast",
]);

const REGULAR_MODEL_IDS = new Set([
  "mabojolu-regular",
  "qwen3.5:2b",
  "mabojolu regular",
]);

const QUALITY_MODEL_IDS = new Set([
  "mabojolu-local",
  "qwen3.5:4b",
  "mabojolu quality",
  "mabojolu local",
]);

function resolveModel(
  model: string,
): ResolvedModel {
  const normalized = model
    .trim()
    .toLowerCase();

  if (FAST_MODEL_IDS.has(normalized)) {
    return {
      label: "Mabojolu Fast",
      description:
        "Generated with the fastest local response model.",
    };
  }

  if (
    REGULAR_MODEL_IDS.has(normalized)
  ) {
    return {
      label: "Mabojolu Regular",
      description:
        "Generated with the balanced local response model.",
    };
  }

  if (
    QUALITY_MODEL_IDS.has(normalized)
  ) {
    return {
      label: "Mabojolu Quality",
      description:
        "Generated with the strongest available local response model.",
    };
  }

  return {
    label: model,
    description:
      "Generated with the model reported by Mabojolu.",
  };
}

export function ResponseModelLabel({
  model,
  isStreaming = false,
}: ResponseModelLabelProps) {
  if (!model?.trim()) {
    return null;
  }

  const resolvedModel =
    resolveModel(model);

  const statusText = isStreaming
    ? `Generating with ${resolvedModel.label}`
    : `Generated with ${resolvedModel.label}`;

  return (
    <div
      aria-label={statusText}
      title={resolvedModel.description}
      className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-text-muted"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          isStreaming
            ? "animate-pulse bg-text-secondary"
            : "bg-text-muted"
        }`}
      />

      <span>{resolvedModel.label}</span>
    </div>
  );
}