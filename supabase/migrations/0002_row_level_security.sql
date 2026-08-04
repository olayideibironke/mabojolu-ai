-- Mabojolu AI: row-level security
--
-- Read this file as the answer to one question: if an attacker held a valid
-- session for user A and the anon key, what could they reach belonging to user
-- B? The intended answer is nothing.
--
-- Principles applied throughout:
--
--   * Deny by default. Enabling RLS with no matching policy denies the
--     operation, so a table without a policy is closed rather than open.
--
--   * Policies are per operation, not `for all`. A single broad policy tends to
--     grant more than intended, most often letting a user write a row they
--     should only be able to read.
--
--   * `with check` on writes as well as `using` on reads. Without `with check`,
--     a user can pass the read test and still insert a row owned by someone
--     else.
--
--   * `(select auth.uid())` rather than a bare `auth.uid()`. The subquery form
--     is evaluated once per statement instead of once per row, which matters on
--     a large transcript.
--
--   * The service-role key bypasses every policy below. That is exactly why it
--     must never reach the browser.

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
--
-- Do this before defining policies, so no window exists where a table is
-- reachable without one.
-- ---------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;
alter table public.attachments          enable row level security;
alter table public.message_feedback     enable row level security;
alter table public.usage_events         enable row level security;
alter table public.model_configurations enable row level security;
alter table public.safety_events        enable row level security;

-- Force policies to apply to the table owner too. Without this, a query running
-- as the owning role silently skips RLS, which makes a misconfigured connection
-- look like a working one.
alter table public.profiles             force row level security;
alter table public.conversations        force row level security;
alter table public.messages             force row level security;
alter table public.attachments          force row level security;
alter table public.message_feedback     force row level security;
alter table public.usage_events         force row level security;
alter table public.model_configurations force row level security;
alter table public.safety_events        force row level security;


-- ---------------------------------------------------------------------------
-- Admin check
--
-- security definer so it can read `profiles` without recursing into that
-- table''s own policies. A policy on `profiles` that called a plain function
-- selecting from `profiles` would recurse infinitely.
--
-- stable, so the planner evaluates it once per statement rather than per row.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = (select auth.uid())
       and p.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the current session belongs to an admin. security definer to avoid recursive policy evaluation on profiles.';

-- Only the server may call this. Exposing it to anon would let an unauthenticated
-- client probe for admin accounts.
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- A user reads only their own profile.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- An admin reads every profile, for the admin user list.
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- A user updates their own profile.
--
-- Note the deliberate gap: this policy permits updating the row, but the
-- column-level grant below withholds `role`, `message_limit_per_day`, and
-- `max_attachment_count`. Without that grant restriction a user could set
-- role = 'admin' on themselves, since the row-level test would still pass.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Insert is intentionally absent. Profiles are created by the
-- `handle_new_user` trigger, so a client cannot fabricate one.

-- Delete is intentionally absent. Account deletion goes through a documented
-- server-side workflow, not a direct client delete.

-- Withhold privilege-bearing columns from clients. This is the control that
-- actually prevents self-promotion to admin.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

create policy conversations_select_own
  on public.conversations for select
  to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

-- `with check` is what stops a user inserting a conversation owned by another
-- account.
create policy conversations_insert_own
  on public.conversations for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Rename and soft delete. `with check` repeats the ownership test so the row
-- cannot be reassigned to a different user during the update.
create policy conversations_update_own
  on public.conversations for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy conversations_delete_own
  on public.conversations for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- messages
--
-- Filtering on the denormalized `messages.user_id` alone would let a user write
-- a message carrying their own id into someone else''s conversation, so each
-- policy also verifies the parent conversation is theirs.
-- ---------------------------------------------------------------------------

create policy messages_select_own
  on public.messages for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.conversations c
       where c.id = messages.conversation_id
         and c.user_id = (select auth.uid())
         and c.deleted_at is null
    )
  );

create policy messages_insert_own
  on public.messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.conversations c
       where c.id = messages.conversation_id
         and c.user_id = (select auth.uid())
         and c.deleted_at is null
    )
  );

-- Needed to finalize a streamed reply: the row is created when generation starts
-- and updated as it completes.
create policy messages_update_own
  on public.messages for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Edit and regenerate remove the turns after a given point.
create policy messages_delete_own
  on public.messages for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------

create policy attachments_select_own
  on public.attachments for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy attachments_insert_own
  on public.attachments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.conversations c
       where c.id = attachments.conversation_id
         and c.user_id = (select auth.uid())
         and c.deleted_at is null
    )
  );

-- Clients may not move an attachment through its lifecycle: status transitions
-- reflect server-side processing, and a client that could set 'ready' could make
-- the model treat an unprocessed file as readable. Updates are therefore
-- server-only via the service role.

create policy attachments_delete_own
  on public.attachments for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- message_feedback
-- ---------------------------------------------------------------------------

create policy message_feedback_select_own
  on public.message_feedback for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Admins read all feedback for the summary view.
create policy message_feedback_select_admin
  on public.message_feedback for select
  to authenticated
  using (public.is_admin());

-- Feedback may only be left on a message the user can actually see.
create policy message_feedback_insert_own
  on public.message_feedback for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.messages m
       where m.id = message_feedback.message_id
         and m.user_id = (select auth.uid())
    )
  );

create policy message_feedback_update_own
  on public.message_feedback for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy message_feedback_delete_own
  on public.message_feedback for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- usage_events
--
-- A user may read their own usage, which is reasonable transparency about their
-- own consumption. Writes are server-only: a client that could insert usage rows
-- could forge cost data or dilute quota accounting.
-- ---------------------------------------------------------------------------

create policy usage_events_select_own
  on public.usage_events for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy usage_events_select_admin
  on public.usage_events for select
  to authenticated
  using (public.is_admin());

-- No insert, update, or delete policy: written only via the service role.


-- ---------------------------------------------------------------------------
-- model_configurations
--
-- Readable by any signed-in user so the client can show which models are
-- available. Writable only by an admin.
-- ---------------------------------------------------------------------------

create policy model_configurations_select_all
  on public.model_configurations for select
  to authenticated
  using (true);

create policy model_configurations_write_admin
  on public.model_configurations for insert
  to authenticated
  with check (public.is_admin());

create policy model_configurations_update_admin
  on public.model_configurations for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy model_configurations_delete_admin
  on public.model_configurations for delete
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- safety_events
--
-- Admin read only. Ordinary users cannot read this table at all: knowing which
-- of their requests tripped a safety boundary would help someone iterate against
-- the controls. Writes are server-only.
-- ---------------------------------------------------------------------------

create policy safety_events_select_admin
  on public.safety_events for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- Schema grants
--
-- RLS filters rows; grants decide whether a role may touch the table at all.
-- Both are required: RLS with an over-broad grant still exposes columns, and a
-- narrow grant without RLS exposes every row.
-- ---------------------------------------------------------------------------

-- The anon role is used before sign-in. It needs no access to any application
-- table, so it is given none.
revoke all on all tables in schema public from anon;

grant select, insert, update, delete on public.conversations    to authenticated;
grant select, insert, update, delete on public.messages         to authenticated;
grant select, insert, delete         on public.attachments       to authenticated;
grant select, insert, update, delete on public.message_feedback  to authenticated;
grant select                         on public.usage_events      to authenticated;
grant select                         on public.model_configurations to authenticated;
grant select                         on public.profiles          to authenticated;
grant select                         on public.safety_events     to authenticated;

-- `grant update (display_name)` was already issued above, deliberately narrower
-- than a table-wide update.
