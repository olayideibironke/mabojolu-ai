begin;

-- Mabojolu guest-profile support.
--
-- Supabase anonymous users have a real auth.users identifier but normally have
-- no email address. The existing profiles table intentionally requires an email,
-- so anonymous profiles receive a stable internal address that is never used for
-- delivery or displayed to the visitor.
--
-- When the visitor later upgrades the anonymous account with a real email, the
-- application will replace this internal value while preserving the same user
-- identifier, conversations, usage history, and billing state.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_email text;
  profile_display_name text;
begin
  profile_email :=
    coalesce(
      nullif(
        trim(
          coalesce(
            new.email,
            ''
          )
        ),
        ''
      ),
      'guest-' ||
        new.id::text ||
        '@anonymous.mabojolu.invalid'
    );

  profile_display_name :=
    case
      when coalesce(
        new.is_anonymous,
        false
      )
      then null
      else nullif(
        trim(
          coalesce(
            new.raw_user_meta_data
              ->> 'display_name',
            ''
          )
        ),
        ''
      )
    end;

  insert into public.profiles (
    id,
    email,
    display_name
  )
  values (
    new.id,
    profile_email,
    profile_display_name
  )
  on conflict (id)
  do update set
    email =
      case
        when excluded.email not like
          'guest-%@anonymous.mabojolu.invalid'
        then excluded.email
        else public.profiles.email
      end,

    display_name =
      coalesce(
        excluded.display_name,
        public.profiles.display_name
      );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates permanent and anonymous Mabojolu profiles. Anonymous users receive a stable internal non-deliverable email until they upgrade their account.';

-- Repair any anonymous auth users that may have been created before this
-- migration was applied but do not yet have an application profile.
insert into public.profiles (
  id,
  email,
  display_name
)
select
  users.id,

  coalesce(
    nullif(
      trim(
        coalesce(
          users.email,
          ''
        )
      ),
      ''
    ),
    'guest-' ||
      users.id::text ||
      '@anonymous.mabojolu.invalid'
  ),

  case
    when coalesce(
      users.is_anonymous,
      false
    )
    then null
    else nullif(
      trim(
        coalesce(
          users.raw_user_meta_data
            ->> 'display_name',
          ''
        )
      ),
      ''
    )
  end
from auth.users as users
left join public.profiles as profiles
  on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

commit;