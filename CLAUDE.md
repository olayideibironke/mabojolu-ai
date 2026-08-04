@AGENTS.md

# Mabojolu AI: development rules

These are the enduring rules for this codebase. They exist because each one was
either a decision that took work to reach or a mistake that was already made once.

## Verify before claiming

Run `npm run verify` (types, lint, tests, build) before saying anything works. Do
not report "clean" unless the commands actually passed, and quote real output
rather than paraphrasing it.

For anything user-facing, drive the running app. A passing test suite is not
evidence that a button works. Two real bugs in this codebase were found only by
driving it: the client-disconnect handler that mislabelled an interruption as a
failure, and the attachment `storagePath` that was never persisted so owners
could not download their own files. Neither was visible in code review.

## Read the bundled Next.js docs

This project runs Next.js 16, which differs from most training data. Read
`node_modules/next/dist/docs/` before using a framework API. Two examples already
encountered:

- `middleware.ts` is deprecated and renamed to `proxy.ts`.
- `next.config.ts` no longer accepts an `eslint` key; `next build` does not run
  ESLint, which is why linting is a separate step in `verify`.

## Honesty in the product

- **Never ship a fake control.** A button that appears functional but does
  nothing is worse than an absent one. Disable it and say why, as the attachment
  control does.
- **Never claim a completed action that did not complete.** This applies to the
  assistant's own output and to status text. An attachment is `uploaded`, not
  `ready`, until processing genuinely succeeds.
- **Do not overstate protection.** No end-to-end encryption claims, and no
  suggestion that prompts are withheld from the provider unless that has been
  verified for the configured plan.
- **No em dashes in product copy.** This is a brand rule. It applies to UI text
  and user-facing error messages.

## Security rules

- **Ownership is a parameter, never an assumption.** Every persistence method
  takes an explicit `userId` and filters on it. Row-level security is the second
  layer, not the only one.
- **Return 404, not 403,** for a resource belonging to another user. A 403
  confirms the id exists.
- **The service-role key bypasses row-level security.** Use
  `createServerSupabaseClient` (user-scoped) by default. Reach for
  `createServiceRoleClient` only when the operation genuinely cannot run as the
  user, and say why in a comment at the call site.
- **Never trust a client-supplied role, status, or model.** Read the role from
  the database. The server decides the model and the message status.
- **Validate uploads by content, not by declared type.** A MIME type is a string
  a client chooses; magic bytes are the file. Rebuild filenames from safe
  characters rather than stripping bad ones.
- **Server-only modules import `server-only`.** It turns an accidental client
  import into a build error instead of a leaked credential.
- **No secrets in logs.** Log codes and identifiers, never prompt text, message
  bodies, or document contents. Safety and usage tables are read by
  administrators, so user content must not be written into them.

## React and rendering rules

The React compiler enforces several of these; the reasons matter beyond the
linter.

- **No impure calls during render.** `Date.now()`, `Math.random()`, and
  `crypto.randomUUID()` belong in event handlers and effects. Use the helpers in
  `src/lib/utilities/ids.ts`.
- **No `setState` in an effect body.** Read external systems with
  `useSyncExternalStore` (see `theme-store.ts` and `media-query.ts`), or derive
  the value during render. An effect that reads then sets causes a cascading
  render.
- **No ref writes during render.** Assign in an effect: a render may be discarded
  and the write would still have happened.
- **Server Components by default.** Add `"use client"` only where browser
  interactivity requires it.
- **Use `Link` for internal navigation,** and `router.refresh()` before
  navigating after an auth change, or the Router Cache serves markup rendered for
  the previous session.

## Architecture rules

- **Depend on the ports, not the vendors.** `AiProvider`, `DatabaseAdapter`, and
  `StoragePort` each have two implementations selected by environment. Adding a
  provider means writing an adapter, never editing a route handler or component.
- **Keep the system prompt server-side and versioned.** Add a new version in
  `src/prompts/system.ts` rather than editing an existing one, so a change is
  testable and reversible.
- **Interruption is not failure.** A stopped generation keeps its partial text
  and is marked `interrupted`. Do not let it become `failed`.
- **Retries must not duplicate a billable generation.** Reuse the idempotency key
  for a retry of the same logical request; use a fresh one for a genuinely new
  request such as regenerate.
- **Check cheap gates before expensive ones.** Authenticate, rate limit,
  validate, check quotas, verify ownership, and only then call a provider.

## Testing rules

- Assert the guarantee, not one expected string. The filename sanitizer is tested
  with a property over hostile inputs, because a hardcoded expectation broke when
  the implementation did something safer.
- When a test fails, find out which side is wrong before changing either. In the
  sanitizer case the implementation was correct and the assertion was not.
- Never weaken a security test to make it pass.
- Test the ownership boundary with two distinct users. A single-user test cannot
  demonstrate isolation.

## Documentation rules

Record what is unverified. `docs/KNOWN_LIMITATIONS.md` exists so that "not yet
tested against a live service" never quietly becomes "working". Update it in the
same change that introduces the limitation.
