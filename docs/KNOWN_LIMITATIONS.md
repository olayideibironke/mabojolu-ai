# Known limitations

Written so that "not yet verified" cannot quietly become "working". Each entry
states what exists, what has not been confirmed, and what would close the gap.

Ordered by risk, highest first.

---

## Pending external verification

These are the two items that cannot be closed without credentials. Everything
else in this document is a deliberate scope decision.

### 1. Live Supabase row-level security has never been executed

**Risk: high.** This is the largest unverified area in the project.

**What exists.** Three migrations defining the schema, per-operation RLS policies
with `with check` on writes, column-level grants that withhold the `role` column,
and a private storage bucket with per-user path policies. The policies were
written deliberately and reviewed line by line.

**What is unverified.** They have never run against a Postgres instance. Reading a
policy is not the same as executing it. A subtly wrong `using` clause, a missing
grant, or a policy that fails to apply for a reason specific to Supabase's
defaults would not be visible from review alone.

**Compensating control.** Ownership is enforced independently in application code:
every persistence method takes an explicit `userId` and filters on it. That layer
**is** verified, with two live sessions. So a mistake in the SQL does not by
itself expose data through the application, though it would expose data to anyone
holding the anon key and querying the database directly.

**To close it.** Follow [SUPABASE.md](SUPABASE.md) section 6, which includes
database-level impersonation tests rather than only application-level checks.

### 2. The live Anthropic provider has never been called

**Risk: moderate.** Mistakes here are visible immediately rather than silent.

**What exists.** An adapter using the official `@anthropic-ai/sdk`, written
against the current API: adaptive thinking left at its default, no `temperature`
or `top_p` (rejected on current models), refusals handled as a successful
response carrying `stop_reason: "refusal"`, and typed SDK errors mapped to our own
error codes.

**What is unverified.** No request has been made. Streaming shape, usage field
names, and error mapping are written from the documentation, not observed.

**Compensating control.** The mock provider exercises the entire pipeline:
streaming, abort, usage accounting, persistence, and error handling. Only the
adapter's own request and response translation is untested.

**To close it.** Add `ANTHROPIC_API_KEY` and set `AI_PROVIDER=anthropic`, then send
one message and confirm the reply streams, usage is recorded in the admin view,
and stopping mid-generation still marks the message `interrupted`.

---

## Architectural limitations

### 3. Rate limiting and concurrency are per instance

The limiter and the concurrency tracker are in-process maps. On a single instance
they work as intended, verified with 40 concurrent requests. Across N serverless
instances each keeps its own counters, so the effective global limit is roughly N
times the configured value.

This is stated in the admin view and in `.env.example` rather than hidden.

**To close it.** Replace the store in `src/lib/security/rate-limit.ts` with Redis
or Upstash. The interface is already shaped for it, so no call site changes.

### 4. Local persistence is not production storage

The local adapter is a single JSON file with no transactions, no concurrent-write
safety beyond a promise chain, and no row-level security. It exists so the product
is fully testable without external services.

Production configuration is refused at boot: environment validation rejects
`PERSISTENCE=local` and `AUTH_MODE=dev` when `NODE_ENV=production`. Verified by
observing `next start` refuse to serve.

### 5. Development authentication trusts a cookie

`AUTH_MODE=dev` accepts a cookie naming one of two fixed identities, with no
cryptographic verification. It exists so ownership boundaries and per-user limits
can be exercised without an auth provider.

Guarded three independent ways: environment validation refuses it in production,
`getSession` checks again at the point of use, and the route that sets it returns
404 outside dev mode. Any one guard failing is not sufficient to open it.

---

## Feature scope

### 6. Attachments are stored and validated but never read

Validation, storage, ownership isolation, and quotas are implemented and tested,
including magic-byte checking that rejects an executable renamed to `.pdf`.

Document processing is **not** implemented. No text is extracted, so the assistant
cannot answer questions about an uploaded file's contents. Attachments therefore
reach `uploaded` and never `ready`, and the upload response says so explicitly.
This is why uploads are disabled by default via
`MABOJOLU_ATTACHMENTS_ENABLED=false`.

**To close it.** Add a processing step that extracts text, sets `extracted_text`,
and advances the status to `ready`. The status field and the column already exist.

### 7. No memory between conversations

Each conversation starts fresh. The product says so in its empty state, its
settings, and its system prompt.

A memory interface is deliberately absent rather than half-built: the
specification requires user review, deletion, and privacy controls before memory
is enabled, and shipping storage without those would create a privacy problem
that is hard to undo.

### 8. No web browsing, code execution, or tools

The tool registry is designed for in `src/lib/ai/provider.ts` but no tools are
registered. The system prompt instructs the assistant to say plainly that it
cannot browse the web or run code, rather than attempting either.

### 9. Conversation titles are derived, not generated

Titles come from the first user message with filler stripped, rather than from a
model call. A generated title costs an extra billable request and adds latency to
the first reply, for a string the user can rename in one click.
`generateConversationTitle` is the seam if that trade changes.

### 10. Older context is dropped, not summarized

When a conversation exceeds the token budget, the oldest turns are dropped and the
count is reported. Summarization is a deliberate future step: it costs an extra
generation and needs its own evaluation. See
[CONTEXT_MANAGEMENT.md](CONTEXT_MANAGEMENT.md).

### 11. Admin is read-only

The admin area shows counts, usage, cost estimates, errors, and safety events. It
cannot yet edit model configuration or per-user limits from the interface. The
`model_configurations` table exists for this; changes are made in the database or
the code registry for now.

---

## Security notes

### 12. The Content Security Policy allows inline scripts and styles

`script-src` includes `'unsafe-inline'` because the pre-paint theme script is
inline, and `style-src` does too because Next.js injects inline styles.
`'unsafe-eval'` is present in development only, for React Refresh.

A nonce-based policy would be stronger. That requires threading a per-request
nonce into the theme script, which is worthwhile follow-up work and is recorded
here rather than described as done.

### 13. Cost estimates are estimates

`estimated_cost_usd` is computed from pricing in the code registry at the time of
the request. Provider pricing changes, and the registry may drift. These figures
are for internal monitoring and are labelled as estimates in the admin view. They
are not a substitute for the provider's invoice.

### 14. No automated dependency scanning

`npm audit` reports zero vulnerabilities at the time of writing, but nothing runs
it on a schedule. Adding Dependabot or a scheduled audit is straightforward and
has not been done.

### 15. End-to-end browser tests are not automated

The chat flow, interruption, editing, theming, and mobile layout were verified by
driving a real Chrome instance with Playwright, and two real bugs were found that
way. Those scripts were exploratory and were not committed as a suite.

**To close it.** Commit Playwright specs covering send, stop, edit, regenerate,
refresh restore, and sign-out, and run them in CI.

---

## What has been verified

For contrast, so this document is not read as a list of everything unknown:

- Streaming, abort mid-generation, retry, and error paths, against a running
  server.
- Cross-user isolation for conversations and attachments, with two live sessions.
- Idempotency: a duplicate-key retry does not create a second message.
- Attachment validation against hostile files, including an executable renamed to
  `.pdf` and an SVG carrying an `onload` handler.
- Admin access control: 404 for anonymous and non-admin, 200 for admin.
- Rate limiting, with 40 concurrent requests.
- Security headers on every response.
- Refresh restoration, rename, delete with confirmation, and search matching
  message bodies rather than only titles.
- Types, lint, 137 tests, and the production build.
