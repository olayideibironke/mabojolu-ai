export interface BrowserModelProgress {
  progress?:
    number;

  text?:
    string;
}

export function browserModelProgressLabel(
  progress:
    BrowserModelProgress,
):
  string {
  const fraction =
    typeof progress
      .progress ===
      "number" &&
    Number.isFinite(
      progress.progress,
    )
      ? Math.max(
          0,
          Math.min(
            1,
            progress.progress,
          ),
        )
      : null;

  if (
    fraction !== null
  ) {
    return (
      "Preparing on-device model... " +
      Math.round(
        fraction * 100,
      ) +
      "%"
    );
  }

  return "Preparing on-device model...";
}
