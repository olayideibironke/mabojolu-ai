# Security model

What Mabojolu protects, how, and what it does not protect. Written so a reviewer
can find the gaps quickly rather than having to infer them.

---

## Trust boundaries

Four boundaries, ordered by how much they are trusted:

| Boundary | Trust | Consequence |
| --- | --- | --- |
| Browser | None | Every input is validated server-side. Roles, model choice, and message status are decided by the server. |
| Provider output | Low | Rendered as data, never as markup. Treated as untrusted when it contains retrieved content. |
| Uploaded files | None | Validated by content, not by declared type. |
| Server environment | Trusted | Holds credentials. Never reaches the browser. |

---

## Authentication and sessions

Email magic link via Supabase Auth. No passwords are stored, so there is nothing
to leak or reset.

**Sessions are verified, not decoded.** `getSession` calls `auth.getUser()`, which
validates the token against the auth server, rather than `getSession()`, which
only decodes the cookie. On a server the cookie is attacker-supplied input, so
only the verifying call is safe.

**Development mode is fenced off.** `AUTH_MODE=dev` accepts a cookie naming one of
two fixed identities with no cryptographic verification. It is refused three
independent ways in production: environment validation at boot, a check inside
`getSession`, and the route that sets it returning 404. One guard failing is not
enough to open it.

---

## Authorization

Two independent layers. Both must fail for data to leak.

**Application layer.** Every persistence method takes an explicit `userId` and
filters on it. Verified with two live sessions: user B cannot list, read, rename,
or delete user A's conversation.

**Database layer.** Row-level security policies filter the same rows again.
Written per operation rather than `for all`, with `with check` on writes: without
`with check`, a user can pass the read test and still insert a row owned by
someone else.

**404, not 403.** A resource belonging to another user returns `404`. A `403`
would confirm the id exists to someone with no right to know.

**Privilege escalation is blocked by grants, not by policy.** The update policy on
`profiles` permits a user to update their own row, so a row-level test alone
would let them set `role = 'admin'`. The actual control is a column-level grant:
`authenticated` may update only `display_name`.

**Admin checks read the database.** Never a token claim, a header, or anything a
client can assert. A non-admin gets `notFound()`, so the area's existence is not
confirmed.

---

## Credential handling

| Credential | Exposure | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Server only | Never sent to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Bypasses all RLS** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Safe only because RLS is correct |

Every module touching a credential imports `server-only`, which turns an
accidental import from a Client Component into a build error rather than a silent
leak.

The service-role client is used in exactly four places, each because the
operation genuinely cannot run as the user: usage writes, safety writes,
attachment status transitions, and cross-user admin aggregates. A client able to
write usage rows could forge cost data; one able to set an attachment to `ready`
could make the model treat unvalidated content as readable.

---

## Input validation

Zod schemas at every API boundary, using `strictObject` so an unknown key is
rejected rather than ignored. Specific protections:

- **No client-supplied system prompt.** The role enum accepts only `user` and
  `assistant`, so a client cannot inject system instructions.
- **The last message must be from the user.** Otherwise a client could put words
  in the assistant's mouth.
- **Conversation ids must be UUIDs,** which blocks probing with arbitrary
  identifiers.
- **Bounded sizes:** 32,000 characters per message, 400 messages per request, 1 MB
  request body, all checked before provider work is scheduled.

---

## Prompt injection boundaries

The system prompt instructs the assistant to treat instructions inside
user-provided documents, retrieved content, or tool results as data rather than
commands, and not to disclose its own instructions.

That is mitigation, not a guarantee. Prompt injection is unsolved, so the
architecture limits the damage instead: no tools are registered, the assistant
cannot browse or execute code, and it has no ability to act on the user's account.
An injection can therefore influence text output, but not take an action.

---

## Attachment security

Layered, each layer assuming the others might be bypassed:

1. **Format allowlist.** Unnamed types are rejected. SVG is excluded because it
   can carry script; archives because they hide contents behind an outer MIME
   type; Office formats because they are zip containers with macro surface.
2. **Extension and MIME agreement.** A disagreement means the client is mistaken
   or lying.
3. **Magic-byte verification.** The decisive check, because a declared MIME type
   is a string the client chooses. Verified: an executable renamed to `.pdf` is
   rejected.
4. **Filenames rebuilt, not cleaned.** Only known-safe characters survive, so
   traversal, null bytes, and control characters cannot get through. A name that
   sanitizes to nothing is rejected rather than replaced with a guess.
5. **Private bucket, signed URLs.** Nothing is publicly readable. Paths begin with
   the owner's user id, which is what the storage policies match on.
6. **Forced download.** `Content-Disposition: attachment` plus `nosniff`, so a
   file the browser might render cannot execute in this origin.

Uploads are disabled by default. Enabling them is a deliberate decision after the
storage controls have been verified against a live project.

---

## Abuse controls

Layered, because each catches something the others cannot:

| Control | Catches |
| --- | --- |
| Rate limit (30 per minute) | Bursts |
| Daily message quota (200) | Sustained heavy use |
| Concurrency cap (2) | Parallel generations from one account |
| Daily spend ceiling | Cost, independent of message count |
| Maintenance mode | Operational stop |

The magic-link endpoint has a tighter limit (5 per 15 minutes) because each
accepted request sends an email; without it the product becomes a mail relay
pointed at a third party's inbox.

**Limitation:** rate limiting and concurrency are in-process. Across N instances
the effective limit is roughly N times the configured value. Documented in the
admin view and in `.env.example`.

---

## Error handling

Provider errors can contain request bodies, header dumps, or credential fragments.
Every error crossing the response boundary is normalized to a stable code and
curated message; the original is kept as `cause` for server-side logging only.
Tested: an error whose message contains a fake key does not leak it.

Failures are logged with codes and identifiers, never prompt text or message
bodies. Safety and usage tables hold counts and event kinds only, because
administrators can read them.

---

## Security headers

Applied in `src/proxy.ts` to every response, so a new route cannot be added
without them:

| Header | Purpose |
| --- | --- |
| `Content-Security-Policy` | Limits script, style, and connection sources |
| `X-Frame-Options: DENY` | Blocks clickjacking of the composer |
| `X-Content-Type-Options: nosniff` | Stops MIME sniffing |
| `Referrer-Policy` | Prevents conversation ids leaking to third parties |
| `Permissions-Policy` | Denies camera, microphone, geolocation, payment, USB |
| `Cross-Origin-Opener-Policy` | Isolates the origin |

**CSP limitation:** `'unsafe-inline'` is required for the pre-paint theme script
and for Next.js's injected styles. A nonce-based policy would be stronger and is
recorded in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## Privacy

Users can delete individual conversations, which removes their messages, and
delete uploaded attachments, which removes both the row and the stored object.
Account deletion is implemented in `deleteAllUserData`; usage rows survive
de-identified so aggregate cost history remains without retaining personal data.

**Not claimed:**

- No end-to-end encryption. Conversations are readable by whoever operates the
  database.
- No claim that prompts are withheld from the provider. Messages are sent to the
  configured AI provider to generate a response.

Both are stated in the product's own settings dialog, not only here.

---

## Reporting a vulnerability

Contact Westforge Holdings Inc. privately. Please do not open a public issue for a
security report.
