create table if not exists public.plugin_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'github')),
  account_label text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.plugin_connections enable row level security;

revoke all on table public.plugin_connections from anon;
revoke all on table public.plugin_connections from authenticated;

comment on table public.plugin_connections is
'Server-only encrypted OAuth connections for Mabojolu workspace plugins.';
