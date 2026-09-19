const RECOVERY_MAX_AGE_MS =
  2 *
  60 *
  60 *
  1_000;

export function safeAuthNext(
  value:
    string |
    null,
):
  string |
  null {
  if (!value) {
    return null;
  }

  return (
    value.startsWith("/") &&
    !value.startsWith("//")
  )
    ? value
    : null;
}

export function hasRecentRecoveryRequest(
  recoverySentAt:
    string |
    null |
    undefined,

  now:
    number =
      Date.now(),
):
  boolean {
  if (!recoverySentAt) {
    return false;
  }

  const timestamp =
    Date.parse(
      recoverySentAt,
    );

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    return false;
  }

  const age =
    now -
    timestamp;

  return (
    age >=
      0 &&
    age <=
      RECOVERY_MAX_AGE_MS
  );
}

export function resolveAuthCallbackTarget(input: {
  requestedNext:
    string |
    null;

  recoverySentAt?:
    string |
    null;

  now?:
    number;
}):
  string {
  const explicit =
    safeAuthNext(
      input.requestedNext,
    );

  if (explicit) {
    return explicit;
  }

  return hasRecentRecoveryRequest(
    input.recoverySentAt,
    input.now,
  )
    ? "/reset-password"
    : "/";
}
