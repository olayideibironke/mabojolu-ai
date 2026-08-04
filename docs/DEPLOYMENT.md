# Deployment

Checklist for taking Mabojolu to production on Vercel with the domain
`mabojolu.com`.

**Nothing here has been performed.** No deployment, no DNS change, no repository
push. This is the procedure, not a record.

Two blockers must clear first, and neither is optional:

1. Row-level security verified against a live Supabase project
   ([SUPABASE.md](SUPABASE.md) section 6).
2. The Anthropic provider verified with one real request.

Deploying before those means shipping an application whose primary access control
has never been executed.

---

## Pre-flight

Run locally and confirm each passes:

```bash
npm run verify      # types, lint, tests, build
npm audit           # expect zero vulnerabilities
git status          # expect a clean tree
```

Then confirm by inspection:

- [ ] No secrets committed. `git log -p | grep -iE 'sk-ant-|eyJhbGciOi'` finds
      nothing, and `.env.local` is untracked.
- [ ] `.env.example` documents every variable and contains no real values.
- [ ] Environment validation refuses production defaults. `NODE_ENV=production`
      with `AUTH_MODE=dev` or `PERSISTENCE=local` must fail to serve. Verified
      already: `next start` refuses and logs why.
- [ ] `MABOJOLU_ATTACHMENTS_ENABLED=false` unless storage controls have been
      verified against the live bucket.

---

## 1. GitHub

**Requires your approval before running.** Nothing has been pushed.

```bash
git remote add origin git@github.com:westforge/mabojolu-ai.git
git push -u origin main
```

Make the repository **private**. It contains the schema, the security model, and
the product's internal decisions.

Before pushing, confirm the history is clean: a secret removed in a later commit
is still present in an earlier one, and pushing publishes the whole history.

---

## 2. Supabase

Follow [SUPABASE.md](SUPABASE.md) in full. Summary:

- [ ] Project created.
- [ ] Migrations `0001`, `0002`, `0003` applied in order.
- [ ] Email provider enabled.
- [ ] Site URL and redirect URLs set for production **and** preview.
- [ ] Your account promoted to admin.
- [ ] **RLS verified with two accounts, including database-level impersonation.**

---

## 3. Vercel

Import the repository at <https://vercel.com/new>. Framework detection and build
settings need no changes.

Set these under **Settings**, then **Environment Variables**. Mark each as
available to Production and Preview.

| Variable | Value |
| --- | --- |
| `AI_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | Your key. **Sensitive.** |
| `PERSISTENCE` | `supabase` |
| `AUTH_MODE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. **Sensitive.** |
| `MABOJOLU_DEFAULT_MODEL` | `mabojolu-core` |
| `MABOJOLU_DAILY_MESSAGE_LIMIT` | e.g. `200` |
| `MABOJOLU_DAILY_COST_LIMIT_USD` | Set a real ceiling before opening access |
| `MABOJOLU_ATTACHMENTS_ENABLED` | `false` until verified |

Do **not** set `NODE_ENV`; Vercel manages it.

Set `MABOJOLU_DAILY_COST_LIMIT_USD` before the first public user. It is the only
control that stops unexpected spend independently of message counts.

---

## 4. Domain

**Requires your approval. No DNS change has been made.**

In Vercel, **Settings**, then **Domains**, add `mabojolu.com` and `www.mabojolu.com`,
then follow the DNS records Vercel provides at your registrar. Typically:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Use the values Vercel shows rather than these, which can change. Propagation
usually takes minutes and can take up to 48 hours.

After the domain resolves, return to Supabase and confirm the Site URL and
redirect URLs use the production domain. Missing this is the most common cause of
a broken magic link on a fresh deployment.

---

## 5. Smoke test

Against the production URL, in order. Stop and investigate on any failure.

**Authentication**
- [ ] `/sign-in` renders the magic-link form, not the development one. Seeing the
      dev form means `AUTH_MODE` is wrong.
- [ ] The emailed link signs you in and lands on the app.
- [ ] Sign out clears the session and the transcript.

**Chat**
- [ ] A message streams a real reply.
- [ ] Stopping mid-generation keeps the partial text and shows the interrupted
      notice.
- [ ] Retry after a failure does not duplicate the message.
- [ ] Markdown, code blocks, and copy all work.

**Persistence**
- [ ] Refresh restores the open conversation.
- [ ] Rename, delete with confirmation, and search all work.
- [ ] Search matches message content, not only titles.

**Isolation**
- [ ] A second account cannot see the first account's conversations.
- [ ] Requesting the first account's conversation id returns 404.

**Operations**
- [ ] `/admin` returns 404 for a non-admin and renders for an admin.
- [ ] Usage and estimated cost appear after a few messages.
- [ ] Security headers present: `curl -sSI https://mabojolu.com | grep -i
      content-security-policy`.

**Failure modes**
- [ ] Temporarily clearing `ANTHROPIC_API_KEY` produces a clear configuration
      error, not a stack trace. Restore it afterwards.

---

## 6. Rollback

Vercel keeps every deployment, so rollback is a promotion rather than a rebuild.

**Application:** **Deployments**, select the last good one, then **Promote to
Production**. Effective in seconds.

**Environment variable:** correct the value and redeploy. Changes do not apply to
a running deployment.

**Database:** migrations are additive and have no down scripts, deliberately: an
automated down migration that drops a table is more dangerous than a manual fix.
To reverse a policy change, apply a corrective migration. Take a backup from
Supabase's **Database**, then **Backups** before any schema change.

**Emergency stop:** set `MABOJOLU_MAINTENANCE_MODE=true` and redeploy. Chat
returns a maintenance message while the rest of the app stays reachable. This is
the fastest way to stop generation without taking the site down.

---

## Post-deployment

- [ ] Record which model is configured and the spend ceiling.
- [ ] Check the admin usage view after the first day of real traffic.
- [ ] Schedule the orphan-attachment cleanup and the soft-delete purge
      ([SUPABASE.md](SUPABASE.md) section 8).
- [ ] Replace the in-memory rate limiter before scaling past one instance
      ([KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) item 3).
- [ ] Add automated dependency scanning.
