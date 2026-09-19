# Mabojolu AI

**Mabojolu by Westforge** — a general-purpose conversational AI product for
thinking, writing, analysis, planning, research, and coding assistance.

A Westforge Holdings Product. [mabojolu.com](https://mabojolu.com)

The name combines Maria, Mobolaji, Mobolajoko, and Mojolaoluwa.

---

## Current status

Read this before drawing conclusions about what is finished. It separates what
has been verified from what has only been written.

| Area | Status |
| --- | --- |
| Streaming chat, abort, retry | Verified against a running server |
| Conversation history, rename, search, delete, refresh restore | Verified |
| Ownership boundaries between accounts | Verified with two live sessions |
| Markdown, code blocks, copy, edit, regenerate, feedback | Verified in a real browser |
| Light, dark, and system themes | Verified |
| Attachment validation and isolation | Verified, including hostile uploads |
| Admin access control | Verified: 404 for non-admin and anonymous |
| Rate limits, quotas, size caps | Verified |
| Tests, lint, types, production build | All passing |
| **Local Ollama inference** | **Primary runtime.** No external API key or per-token charge. |
| **Optional Anthropic compatibility** | Disabled by default; requires explicit paid-provider opt-in and credentials. |
| **Live Supabase row-level security** | **Pending external configuration.** Written and reviewed, never executed. |

The cognitive kernel and default inference architecture are local-first. Ollama
serves the real local models without an external API key or per-token provider
bill. Mock mode remains available for deterministic tests. Supabase production
persistence still requires its own configured project and is documented in
[docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

---

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with one of the two local development
identities. No external AI API key is required. Mabojolu defaults to Ollama for
real local inference and stores development conversations in a JSON file under
`.mabojolu-data/`.

Ollama must be running on the configured local endpoint and the selected local
model must be installed. The default model registry contains Mabojolu Fast,
Regular, and Quality local modes. Mock mode remains available for automated
tests and deterministic UI work.

Copy `.env.example` to `.env.local` if you want to change any defaults. Every
variable is documented there.

### Optional paid-provider compatibility

Paid external inference is not required for Mabojolu to operate and is disabled
by default. An operator must deliberately set both the external provider and the
paid-provider opt-in flag before a cloud API can be used.

Never commit `.env.local`. It is git-ignored; `.env.example` is the only env file
that is tracked, and it contains no real values.

---

## Compute independence

Mabojolu's inference architecture is intentionally designed so paid API tokens
are optional infrastructure rather than a requirement for cognition or chat.

The current routing order is:

1. user-owned browser/WebGPU compute;
2. operator-controlled local Ollama;
3. operator-controlled self-hosted inference;
4. deterministic local mock compute for tests;
5. paid external inference only after explicit opt-in.

`src/lib/ai/compute-router.ts` enforces that ordering and refuses metered
external inference by default. `src/lib/ai/browser-compute.ts` defines the
browser-owned execution contract, while the browser chat transport and module
worker connect eligible Fast text chats to real WebGPU inference.

Browser inference is browser-first for new Fast text chats on WebGPU-capable
devices. Mabojolu profiles coarse device resources before generation: constrained
and standard devices use the 1B browser model, while stronger devices may try the
3B model first and automatically downgrade to 1B if allocation fails before any
text is emitted. Long conversations are trimmed as coherent recent turns within
the browser model's context window; Mabojolu never truncates the current user
request just to force it into the on-device model.

A browser-compute circuit breaker temporarily routes retries to local Ollama
after a complete on-device failure, so a device does not repeatedly hit the same
failing path. The server still handles authentication, quotas, and conversation
persistence, including the verified 10 guest / 20 registered / 4-hour free
access policy.

The WebLLM 0.2.85 runtime is pinned in Mabojolu's own dependency graph and
bundled into the application worker at build time. Browser execution therefore
no longer depends on esm.run, jsDelivr, or another JavaScript runtime CDN.

Model weights and compiled model libraries are still fetched from the upstream
locations defined by WebLLM's model registry on first use and then cached by the
browser. Those large model artifacts are the remaining external delivery
dependency; self-hosting them requires a dedicated artifact mirror rather than
placing multi-gigabyte model files in the application repository.

---

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Full test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run verify` | Types, lint, tests, and build in sequence |

Run `npm run verify` before committing. It is the same gate used throughout
development.

---

## Architecture

```
src/
  app/                     Routes. Server Components by default.
    api/
      chat/                Streaming chat endpoint (SSE)
      conversations/       List, read, rename, delete
      feedback/            Message ratings
      attachments/         Upload, list, delete, download
      auth/                Sign-in, sign-out, magic link
    admin/                 Protected administration
    sign-in/               Authentication entry point
  components/
    chat/                  Transcript, composer, message, markdown
    layout/                Sidebar, settings, theme
    ui/                    Button, icons, brand mark
    auth/                  Sign-in forms
  lib/
    ai/                    Provider gateway, model registry, context, streaming
      providers/           Mock and Anthropic adapters
    attachments/           Validation and object storage
    auth/                  Session resolution
    database/              Persistence port, local and Supabase adapters
    security/              Rate limiting, usage limits
    utilities/             Ids, theme, media queries
    validation/            Request schemas
  hooks/                   useChat, useConversations, useAutoScroll
  prompts/                 Versioned system prompt
  types/                   Shared types
  proxy.ts                 Session refresh and security headers
supabase/migrations/       Schema, RLS policies, storage policies
docs/                      Setup, security, deployment, limitations
```

### Three ports, two implementations each

The product depends on interfaces, not vendors. Each port is selected by
environment variable, so swapping a backend is configuration rather than a code
change.

| Port | Local | Production |
| --- | --- | --- |
| AI inference | Browser WebGPU / local Ollama | Browser WebGPU first for eligible Fast text; configured Ollama fallback |
| Persistence (`src/lib/database/types.ts`) | `local` JSON file | `supabase` |
| Object storage (`src/lib/attachments/storage.ts`) | Local filesystem | Supabase Storage |

### Why the official Anthropic SDK rather than the Vercel AI SDK

This product's specification required building the provider interface, message
normalization, streaming controller, abort handling, error normalization, and
usage extraction directly. That is substantially the same surface the Vercel AI
SDK provides, so adding it would have duplicated the layer rather than replaced
it, while coupling the product to a second abstraction. The official
`@anthropic-ai/sdk` sits behind our own gateway instead.

### Ownership is enforced twice

Every persistence method takes an explicit `userId` and filters on it, and the
database enforces the same rule again through row-level security. Both layers
have to fail for one user's data to reach another.

A request for a conversation belonging to someone else returns `404`, not `403`,
so the API does not confirm that an id exists to a caller with no right to know.

---

## Documentation

| Document | Contents |
| --- | --- |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Creating the project, applying migrations, auth redirect URLs |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, controls, and what is not protected |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment checklist and rollback |
| [docs/CONTEXT_MANAGEMENT.md](docs/CONTEXT_MANAGEMENT.md) | How conversation context is built and budgeted |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | Limitations and unverified areas |
| [CLAUDE.md](CLAUDE.md) | Development rules for future sessions |

---

## Honest notes

What this product does **not** do, stated plainly because overstating it would be
worse than the gaps:

- **No memory between conversations.** Each conversation starts fresh. A memory
  interface is designed but disabled until user review, deletion, and privacy
  controls exist.
- **No web browsing and no code execution.** The assistant says so when asked.
- **No end-to-end encryption.** Conversations are readable by whoever operates
  the database.
- **No claim that prompts are withheld from the provider.** Messages are sent to
  the configured AI provider in order to generate a response.
- **Attachments are stored and validated but not read.** Document processing is
  not implemented, so the assistant cannot answer questions about an uploaded
  file's contents, and it will say so rather than guessing.
- **Rate limiting is per instance.** The limiter is in memory, so on a
  multi-instance deployment the effective limit is multiplied by the instance
  count.

---

## License and ownership

Copyright Westforge Holdings Inc. All rights reserved.
