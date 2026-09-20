alter table public.plugin_connections
  drop constraint if exists plugin_connections_provider_check;

alter table public.plugin_connections
  add constraint plugin_connections_provider_check
  check (
    provider in (
      'google-calendar',
      'google-drive',
      'google-gmail',
      'microsoft',
      'github',
      'vercel',
      'supabase',
      'cloudflare',
      'resend'
    )
  );
