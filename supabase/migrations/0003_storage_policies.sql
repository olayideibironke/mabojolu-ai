-- Mabojolu AI: attachment storage
--
-- Creates the private bucket for uploads and the policies governing it.
--
-- The central decision: the bucket is private. Files are reached only through
-- short-lived signed URLs minted server-side after an ownership check. A public
-- bucket would make every uploaded document world-readable to anyone who learned
-- or guessed its path, which for user-uploaded documents is unacceptable.
--
-- Path convention, relied on by every policy below:
--
--   {user_id}/{conversation_id}/{attachment_id}-{sanitized_filename}
--
-- The first path segment is the owner''s UUID, so ownership is decidable from the
-- object name alone via `storage.foldername(name)[1]`.

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'attachments',
  'attachments',

  -- Private. Access requires a signed URL.
  false,

  -- 20 MB, enforced by storage itself so a client that bypasses the application
  -- still cannot upload something larger.
  20971520,

  -- Deliberately narrow. Each entry is a format we can validate and that the
  -- selected provider can genuinely read. Office formats, archives, and SVG are
  -- excluded: SVG can carry script, and archives hide their real contents behind
  -- an outer MIME type.
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- Policies on storage.objects
--
-- RLS is already enabled on storage.objects by Supabase. These policies are
-- scoped to the attachments bucket so they cannot affect any other bucket.
-- ---------------------------------------------------------------------------

-- Read your own files.
--
-- Signed URLs are generated server-side, but this policy still matters: it is
-- what stops an authenticated client listing or fetching another user''s objects
-- directly through the storage API.
create policy attachments_read_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Upload only beneath your own prefix.
--
-- Without the folder test, any authenticated user could write into another
-- user''s directory, which would let them plant a file that the other account''s
-- signed URLs would then serve.
create policy attachments_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Delete your own files, so the documented "delete my attachments" right is
-- genuinely exercisable.
create policy attachments_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Update is intentionally absent. Overwriting an object in place would let the
-- bytes behind an already-processed attachment change after validation, so a
-- replacement is a fresh upload with a new path.


-- ---------------------------------------------------------------------------
-- Orphan cleanup
--
-- Storage objects are not foreign-keyed to the attachments table, so deleting a
-- conversation leaves its files behind. This function removes objects with no
-- surviving attachment row.
--
-- Intended to run on a schedule (pg_cron, or an external job). It is not wired to
-- a trigger, because deleting storage objects inside a table trigger would make
-- an ordinary delete fail if storage were briefly unavailable.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_orphaned_attachments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  with orphans as (
    delete from storage.objects o
     where o.bucket_id = 'attachments'
       and not exists (
         select 1
           from public.attachments a
          where a.storage_path = o.name
       )
       -- Grace period: an object is created moments before its row, so a
       -- freshly uploaded file must not be mistaken for an orphan.
       and o.created_at < now() - interval '1 hour'
    returning 1
  )
  select count(*) into removed from orphans;

  return removed;
end;
$$;

comment on function public.cleanup_orphaned_attachments() is
  'Removes storage objects with no attachment row. Run on a schedule; not trigger-driven.';

-- Server-side only. No client role should be able to trigger bulk deletion.
revoke all on function public.cleanup_orphaned_attachments() from anon, authenticated;
