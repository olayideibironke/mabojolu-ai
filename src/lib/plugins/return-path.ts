export function normalizePluginReturnPath(
  value:
    string |
    null |
    undefined,
):
  string {
  const fallback =
    "/";

  if (!value) {
    return fallback;
  }

  const trimmed =
    value.trim();

  if (
    !trimmed.startsWith(
      "/",
    ) ||
    trimmed.startsWith(
      "//",
    ) ||
    trimmed.includes(
      "\\",
    )
  ) {
    return fallback;
  }

  try {
    const parsed =
      new URL(
        trimmed,
        "https://mabojolu.invalid",
      );

    if (
      parsed.origin !==
        "https://mabojolu.invalid"
    ) {
      return fallback;
    }

    return (
      parsed.pathname +
      parsed.search +
      parsed.hash
    );
  } catch {
    return fallback;
  }
}
