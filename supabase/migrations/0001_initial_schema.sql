-- Mabojolu AI: initial schema
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting into the SQL
-- editor in the Supabase dashboard. See docs/SUPABASE.md for the full procedure.
--
-- Conventions used throughout:
--   * UUID primary keys, so identifiers are not guessable by increment.
--   * Every user-owned table carries `user_id` referencing `auth.users`, which
--     is what row-level security filters on.
--   * `on delete cascade` from the owning user, so deleting an account really
--     removes their data rather than orphaning it.
--   * `timestamptz` everywhere. A naive timestamp silently misreports across
--     time zones.
--
-- Row-level security is enabled and policies are defined in migration 0002.
-- The two are separate files so a policy change can be reviewed on its own.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- `gen_random_uuid()` lives in pgcrypto. Supabase enables it by default, but
-- stating it makes this migration self-contained on a bare Postgres too.
create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------------
-- Enumerated types
--
-- Enums rather than free-text columns: an invalid state becomes a write error
-- instead of a value the application has to defend against on every read.
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('user', 'admin');

create type public.message_role as enum ('user', 'assistant');

-- `interrupted` is a first-class outcome, not a failure: the user stopped
-- generation and the partial response is intentionally retained.
create type public.message_status as enum (
  'pending',
  'streaming',
  'complete',
  'interrupted',
  'failed'
);

create type public.feedback_rating as enum ('up', 'down');

create type public.attachment_status as enum (
  'pending',
  'uploaded',
  'processing',
  'ready',
  'failed'
);

create type public.safety_severity as enum ('info', 'warning', 'critical');


-- ---------------------------------------------------------------------------
-- profiles
--
-- Application-level user data. Kept separate from `auth.users`, which is owned
-- by Supabase Auth and should not be altered directly.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,

  -- Authorization role. Checked server-side; never trusted from a client.
  -- Defaults to 'user' so a new signup cannot self-promote.
  role public.user_role not null default 'user',

  -- Per-user overrides of the global limits. Null means "use the global value",
  -- which keeps a plan change from having to rewrite every row.
  message_limit_per_day integer,
  max_attachment_count integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_not_blank check (length(trim(email)) > 0),
  constraint profiles_message_limit_positive
    check (message_limit_per_day is null or message_limit_per_day > 0),
  constraint profiles_attachment_count_positive
    check (max_attachment_count is null or max_attachment_count >= 0)
);

comment on table public.profiles is
  'Application user profile. Role governs admin access and is enforced server-side.';
comment on column public.profiles.role is
  'Never accept this value from a client. Promotion is a manual administrative action.';


-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null default 'New chat',

  -- Model pinned at creation, so a later default change does not retroactively
  -- rewrite what a historical conversation was answered by.
  model_id text,

  -- Which system-prompt version produced this conversation. Makes a prompt
  -- regression traceable to the conversations it affected.
  prompt_version text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft deletion, justified here specifically: it allows an "undo delete"
  -- window and keeps message rows referentially intact while a background job
  -- purges them. Reads must always filter `deleted_at is null`.
  deleted_at timestamptz,

  constraint conversations_title_length check (length(title) between 1 and 200)
);

comment on column public.conversations.deleted_at is
  'Soft delete. Every read path must filter on deleted_at is null.';

-- The sidebar query: a user''s conversations, newest first, excluding deleted.
-- Partial index so deleted rows do not bloat it.
create index conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc)
  where deleted_at is null;

-- Supports the purge job that hard-deletes rows after the undo window.
create index conversations_deleted_at_idx
  on public.conversations (deleted_at)
  where deleted_at is not null;

-- Title search. `gin_trgm_ops` gives substring matching, which `like 'x%'`
-- cannot do on its own.
create extension if not exists pg_trgm;
create index conversations_title_trgm_idx
  on public.conversations using gin (title gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,

  -- Denormalized owner. Redundant with conversations.user_id, but it lets every
  -- row-level security policy on this table filter without a join, which is
  -- both faster and harder to get wrong.
  user_id uuid not null references auth.users (id) on delete cascade,

  role public.message_role not null,
  content text not null,
  status public.message_status not null default 'complete',

  -- Client-generated identifier used for idempotency. A retried request carries
  -- the same value, so the unique index below turns a duplicate insert into a
  -- conflict rather than a second billable message.
  client_id text,

  model_id text,
  prompt_version text,

  -- Token accounting for cost reporting.
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cache_write_tokens integer,

  -- Stable error code when status is 'failed'. Never a stack trace.
  error_code text,

  created_at timestamptz not null default now(),

  constraint messages_content_length check (length(content) <= 200000),
  constraint messages_tokens_non_negative check (
    coalesce(input_tokens, 0) >= 0
    and coalesce(output_tokens, 0) >= 0
    and coalesce(cache_read_tokens, 0) >= 0
    and coalesce(cache_write_tokens, 0) >= 0
  ),
  -- A failed message must say why, and a successful one must not carry an error.
  constraint messages_error_code_matches_status check (
    (status = 'failed' and error_code is not null)
    or (status <> 'failed' and error_code is null)
  )
);

comment on column public.messages.client_id is
  'Idempotency key from the client. Unique per conversation, so a retry cannot duplicate a message.';

-- Transcript order. `created_at, id` breaks ties deterministically when two
-- messages land in the same millisecond.
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at, id);

-- Enforces idempotency. Partial, because client_id is null for server-created
-- rows and multiple nulls must remain allowed.
create unique index messages_conversation_client_id_key
  on public.messages (conversation_id, client_id)
  where client_id is not null;

-- Per-user quota counting over a time window.
create index messages_user_created_idx
  on public.messages (user_id, created_at desc);

-- Full-text search across message bodies, so a user can find a conversation by
-- something they said in it.
create index messages_content_trgm_idx
  on public.messages using gin (content gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Sanitized filename for display. The stored object name is storage_path.
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,

  -- Path within the private storage bucket. Never a public URL: access is
  -- granted only through short-lived signed URLs.
  storage_path text not null unique,

  -- Nothing may treat a file as readable by the model before 'ready'. This is
  -- what stops the assistant claiming to have understood an unprocessed file.
  status public.attachment_status not null default 'pending',
  failure_reason text,

  -- Extracted text once processing succeeds. Null until then.
  extracted_text text,

  created_at timestamptz not null default now(),

  constraint attachments_size_positive check (size_bytes > 0),
  -- Hard ceiling at the database layer as well as in the application, so a bug
  -- in one cannot admit an unbounded file.
  constraint attachments_size_within_limit check (size_bytes <= 20971520),
  constraint attachments_filename_length check (length(filename) between 1 and 255),
  constraint attachments_failure_reason_matches_status check (
    (status = 'failed' and failure_reason is not null)
    or (status <> 'failed')
  )
);

create index attachments_conversation_idx
  on public.attachments (conversation_id, created_at);

create index attachments_user_idx on public.attachments (user_id);

-- Counting a user''s live attachments against their quota.
create index attachments_user_status_idx
  on public.attachments (user_id, status);


-- ---------------------------------------------------------------------------
-- message_feedback
--
-- A separate table rather than a column on messages: it keeps an optional free
-- text note out of the hot transcript read, and leaves room for more than one
-- rater later.
-- ---------------------------------------------------------------------------

create table public.message_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  rating public.feedback_rating not null,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One rating per user per message. Changing a rating updates this row.
  constraint message_feedback_unique_per_user unique (message_id, user_id),
  constraint message_feedback_note_length check (
    note is null or length(note) <= 2000
  )
);

create index message_feedback_message_idx
  on public.message_feedback (message_id);

-- The admin feedback summary.
create index message_feedback_rating_created_idx
  on public.message_feedback (rating, created_at desc);


-- ---------------------------------------------------------------------------
-- usage_events
--
-- One row per generation. The source of truth for usage and cost reporting.
-- Deliberately holds no prompt or response text.
-- ---------------------------------------------------------------------------

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),

  -- Nullable and `on delete set null`: aggregate cost history must survive an
  -- account deletion, but must stop identifying the person.
  user_id uuid references auth.users (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,

  provider text not null,
  model_id text not null,

  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,

  -- Estimated at write time from the registry''s pricing, because provider
  -- pricing changes and a historical row should keep the cost then in effect.
  estimated_cost_usd numeric(12, 6) not null default 0,

  finish_reason text not null,
  created_at timestamptz not null default now(),

  constraint usage_events_tokens_non_negative check (
    input_tokens >= 0
    and output_tokens >= 0
    and cache_read_tokens >= 0
    and cache_write_tokens >= 0
  ),
  constraint usage_events_cost_non_negative check (estimated_cost_usd >= 0)
);

comment on table public.usage_events is
  'Token and cost accounting. Contains no prompt or response content by design.';

-- Cost rollups by provider and model over a period.
create index usage_events_model_created_idx
  on public.usage_events (provider, model_id, created_at desc);

-- Per-user usage, for quotas and per-user cost views.
create index usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- model_configurations
--
-- Runtime overrides of the code-level model registry, so a model can be
-- disabled or re-priced without a deploy. The registry in
-- src/lib/ai/models.ts remains the default; a row here overrides it.
-- ---------------------------------------------------------------------------

create table public.model_configurations (
  -- Matches ModelDefinition.id in the code registry.
  model_id text primary key,

  enabled boolean not null default true,

  -- Null means "use the registry value".
  max_output_tokens integer,
  input_price_per_million_usd numeric(10, 4),
  output_price_per_million_usd numeric(10, 4),

  -- Optional per-model daily spend ceiling for cost control.
  daily_cost_limit_usd numeric(12, 2),

  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint model_configurations_tokens_positive check (
    max_output_tokens is null or max_output_tokens > 0
  ),
  constraint model_configurations_prices_non_negative check (
    coalesce(input_price_per_million_usd, 0) >= 0
    and coalesce(output_price_per_million_usd, 0) >= 0
  )
);


-- ---------------------------------------------------------------------------
-- safety_events
--
-- Audit trail for refusals, prompt-injection detections, and abuse signals.
-- Read by administrators, so it must not contain user content.
-- ---------------------------------------------------------------------------

create table public.safety_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,

  -- For example 'provider_refusal', 'prompt_injection_suspected',
  -- 'rate_limit_exceeded', 'attachment_rejected'.
  kind text not null,
  severity public.safety_severity not null default 'info',

  -- Non-sensitive detail only. Copying prompt text here would turn an audit
  -- trail into a privacy leak, since admins can read this table.
  detail text,

  created_at timestamptz not null default now(),

  constraint safety_events_detail_length check (
    detail is null or length(detail) <= 2000
  )
);

comment on column public.safety_events.detail is
  'Never store prompt, message, or document content here. Administrators can read this table.';

create index safety_events_kind_created_idx
  on public.safety_events (kind, created_at desc);

create index safety_events_severity_created_idx
  on public.safety_events (severity, created_at desc)
  where severity in ('warning', 'critical');


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Maintain updated_at in the database rather than trusting each caller to
-- remember it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
-- Empty search_path: prevents a schema-shadowing attack against an unqualified
-- name inside a function that runs on every write.
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create trigger message_feedback_set_updated_at
  before update on public.message_feedback
  for each row execute function public.set_updated_at();


-- Advance a conversation''s updated_at when a message is added, so the sidebar
-- orders by real activity. Doing this in a trigger keeps ordering correct even
-- if a future writer forgets to touch the parent row.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();


-- Create a profile automatically when a user signs up.
--
-- security definer is required: this runs during Supabase''s auth insert, where
-- the caller has no rights on public.profiles. The empty search_path and the
-- fixed column list keep that elevation tightly scoped, and `role` is
-- deliberately not settable from signup metadata so a user cannot self-promote.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Enforce the attachment-count quota in the database.
--
-- The application checks this too. Keeping it here as well means a bug in one
-- path cannot let a user exceed their quota.
create or replace function public.enforce_attachment_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
  allowed_count integer;
begin
  select coalesce(p.max_attachment_count, 20)
    into allowed_count
    from public.profiles p
   where p.id = new.user_id;

  -- No profile means no quota to check yet; the foreign key still applies.
  if allowed_count is null then
    return new;
  end if;

  select count(*)
    into current_count
    from public.attachments a
   where a.user_id = new.user_id
     and a.status <> 'failed';

  if current_count >= allowed_count then
    raise exception 'Attachment limit reached for this account (% of %).',
      current_count, allowed_count
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger attachments_enforce_quota
  before insert on public.attachments
  for each row execute function public.enforce_attachment_quota();
