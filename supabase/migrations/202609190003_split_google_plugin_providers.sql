alter table public.plugin_connections
  drop constraint if exists plugin_connections_provider_check;

insert into public.plugin_connections (
  user_id,
  provider,
  account_label,
  access_token_encrypted,
  refresh_token_encrypted,
  expires_at,
  scopes,
  created_at,
  updated_at
)
select
  user_id,
  split.provider,
  account_label,
  access_token_encrypted,
  refresh_token_encrypted,
  expires_at,
  scopes,
  created_at,
  updated_at
from public.plugin_connections
cross join (
  values
    ('google-calendar'::text),
    ('google-drive'::text),
    ('google-gmail'::text)
) as split(provider)
where plugin_connections.provider = 'google'
on conflict (user_id, provider) do nothing;

delete from public.plugin_connections
where provider = 'google';

alter table public.plugin_connections
  add constraint plugin_connections_provider_check
  check (
    provider in (
      'google-calendar',
      'google-drive',
      'google-gmail',
      'microsoft',
      'github'
    )
  );
