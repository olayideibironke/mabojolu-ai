# Supabase setup

How to move Mabojolu from local development storage to a real database with
row-level security.

**Not yet performed.** The migrations and adapter are written and reviewed but
have never run against a live project. Treat the verification steps at the end as
required work, not as a formality.

---

## 1. Create the project

1. Sign in at <https://supabase.com/dashboard>.
2. **New project**. Choose a region close to your users, since it determines
   database latency.
3. Save the database password somewhere safe. It is shown once.
4. Wait for provisioning to finish, usually a minute or two.

The free tier is sufficient for development and early production. No purchase is
required to complete this guide.

## 2. Collect the credentials

In the dashboard, open **Project Settings**, then **API**. You need three values:

| Value | Environment variable | Exposure |
| --- | --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Safe in the browser |
| `anon` public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe in the browser, protected by row-level security |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **Server only. Never expose.** |

The `service_role` key bypasses every row-level security policy. If it reaches a
browser, every user's conversations are readable by anyone. It must never carry a
`NEXT_PUBLIC_` prefix, and `src/lib/auth/supabase-server.ts` imports
`server-only` so an accidental client import fails the build rather than leaking
silently.

Add all three to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

PERSISTENCE=supabase
AUTH_MODE=supabase
```

`PERSISTENCE` and `AUTH_MODE` are what actually switch the application over.
Without them the credentials are ignored and local storage remains in use.

## 3. Apply the migrations

Three files, applied in numeric order. Order matters: policies reference tables,
and the storage bucket references nothing else but should follow both.

| File | Contents |
| --- | --- |
| `0001_initial_schema.sql` | Tables, enums, constraints, indexes, triggers |
| `0002_row_level_security.sql` | RLS policies and grants |
| `0003_storage_policies.sql` | Private attachments bucket and its policies |

### Option A: SQL editor

For each file in order: open **SQL Editor**, paste the entire contents, and run
it. Confirm each completes without error before starting the next.

### Option B: Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

The CLI tracks which migrations have been applied, which is preferable once the
project is real.

## 4. Configure authentication

Under **Authentication**, then **Providers**, confirm **Email** is enabled. The
application uses magic links, so no password configuration is needed.

Under **Authentication**, then **URL Configuration**, set:

| Field | Local development | Production |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | `https://mabojolu.com` |
| Redirect URLs | `http://localhost:3000/auth/callback` | `https://mabojolu.com/auth/callback` |

Add both, plus a Vercel preview pattern if you use preview deployments:

```
http://localhost:3000/auth/callback
https://mabojolu.com/auth/callback
https://*-your-team.vercel.app/auth/callback
```

A magic link redirects to a URL that is not on this list will fail, and the error
is not obvious from the application side. This is the most common setup mistake.

## 5. Grant yourself admin

The signup trigger creates every profile with `role = 'user'`, deliberately: a
client cannot promote itself, and column-level grants withhold the `role` column
from the `authenticated` role entirely.

Promotion is therefore a manual database action. Sign in once so your profile
exists, then run in the SQL editor:

```sql
update public.profiles
   set role = 'admin'
 where email = 'you@example.com';
```

## 6. Verify row-level security

**Do not skip this.** Unverified RLS is the single largest risk in this
deployment. Reviewing the policies is not the same as executing them.

### Create two accounts

Sign in as two different email addresses. As the first, start a conversation and
send a message. Note its id from the `?c=` URL parameter.

### Confirm isolation as the second user

Signed in as the second account, each of these must fail:

| Attempt | Expected |
| --- | --- |
| `GET /api/conversations` | Does not include the first user's conversation |
| `GET /api/conversations/{first-user-id}` | `404` |
| `PATCH /api/conversations/{first-user-id}` | `404` |
| `DELETE /api/conversations/{first-user-id}` | `404` |
| `GET /api/attachments?conversationId={first}` | Empty list |

`404` rather than `403` is correct: a `403` would confirm the id exists.

### Confirm at the database level

Application filters and RLS are separate layers, and this checks the second one
directly. In the SQL editor:

```sql
-- Impersonate the second user at the database level.
set local role authenticated;
set local request.jwt.claims to '{"sub":"<second-user-uuid>","role":"authenticated"}';

-- Must return zero rows.
select id, title from public.conversations
 where user_id = '<first-user-uuid>';

-- Must fail, not silently insert.
insert into public.messages (conversation_id, user_id, role, content, status)
values ('<first-user-conversation-id>', '<second-user-uuid>', 'user', 'injected', 'complete');

reset role;
```

Zero rows and a failed insert mean the policies are doing their job. Rows
returned, or a successful insert, means they are not: stop and fix before
deploying.

### Confirm a user cannot promote themselves

```sql
set local role authenticated;
set local request.jwt.claims to '{"sub":"<any-user-uuid>","role":"authenticated"}';

-- Must fail: the role column is not granted to authenticated.
update public.profiles set role = 'admin' where id = '<any-user-uuid>';

reset role;
```

## 7. Enable attachments, once verified

Attachments stay off until the storage controls have been checked against the
live bucket:

```bash
MABOJOLU_ATTACHMENTS_ENABLED=true
```

Then verify, as the second user:

- Uploading beneath another user's path prefix fails.
- Requesting another user's object through the storage API fails.
- A signed URL expires and stops working.

## 8. Scheduled maintenance, optional

Two functions are provided for periodic work. Neither runs automatically.

```sql
-- Remove storage objects with no surviving attachment row.
select public.cleanup_orphaned_attachments();
```

Soft-deleted conversations accumulate until purged. Decide a retention window and
schedule accordingly, for example with `pg_cron`:

```sql
delete from public.conversations
 where deleted_at is not null
   and deleted_at < now() - interval '30 days';
```

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Magic link opens the sign-in page with an error | Callback URL not in the redirect allowlist |
| Every query returns empty for a signed-in user | `PERSISTENCE` still set to `local`, or the profile row was never created |
| `permission denied for table` | Migration `0002` not applied, so grants are missing |
| Admin page returns 404 for the right person | `role` still `user`; run the promotion query |
| Uploads fail with a policy error | Migration `0003` not applied, or the path does not begin with the user's id |
| Build fails complaining about the service role key | A server-only module was imported from a Client Component |
