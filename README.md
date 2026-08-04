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
| **Live Anthropic provider** | **Pending external configuration.** Not verified. |
| **Live Supabase row-level security** | **Pending external configuration.** Written and reviewed, never executed. |

Everything above runs today against a local mock AI provider and local
file-backed persistence, with no external accounts and no cost. The two pending
items require credentials and are detailed in
[docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

---

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with one of the two local development
identities. No API key and no database are required: the default configuration
uses a mock AI provider and stores conversations in a JSON file under
`.mabojolu-data/`.

The mock provider echoes your message and states plainly that it is not a real
model response, so mock output is never mistaken for a real answer.

Copy `.env.example` to `.env.local` if you want to change any defaults. Every
variable is documented there.

### Connecting a real model

1. Create an API key at <https://platform.claude.com> (Settings, then API keys).
   A Claude.ai or Claude Code subscription does **not** include API access; the
   API is billed separately.
2. Add to `.env.local`:

   ```bash
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Restart the dev server.

Never commit `.env.local`. It is git-ignored; `.env.example` is the only env file
that is tracked, and it contains no real values.

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
| AI provider (`src/lib/ai/provider.ts`) | `mock` | `anthropic` |
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
