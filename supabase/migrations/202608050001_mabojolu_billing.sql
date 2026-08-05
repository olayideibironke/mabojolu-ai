begin;

create table if not exists public.billing_accounts (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,

  plan_id text not null default 'none'
    check (
      plan_id in (
        'none',
        'starter',
        'plus',
        'pro'
      )
    ),

  subscription_status text not null default 'none'
    check (
      subscription_status in (
        'none',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid'
      )
    ),

  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  current_period_start timestamptz,
  current_period_end timestamptz,

  included_usage_micros bigint not null default 0
    check (included_usage_micros >= 0),

  used_usage_micros bigint not null default 0
    check (used_usage_micros >= 0),

  prepaid_balance_micros bigint not null default 0
    check (prepaid_balance_micros >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_usage_reservations (
  id text primary key,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  conversation_id uuid
    references public.conversations(id)
    on delete set null,

  model_id text not null,

  funding_source text not null
    check (
      funding_source in (
        'subscription',
        'prepaid'
      )
    ),

  reserved_micros bigint not null
    check (reserved_micros > 0),

  actual_micros bigint
    check (
      actual_micros is null
      or actual_micros >= 0
    ),

  status text not null default 'reserved'
    check (
      status in (
        'reserved',
        'settled',
        'released'
      )
    ),

  created_at timestamptz not null default now(),
  settled_at timestamptz,

  constraint billing_actual_not_above_reserve
    check (
      actual_micros is null
      or actual_micros <= reserved_micros
    )
);

create table if not exists public.billing_credit_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  external_reference text not null unique,

  amount_micros bigint not null
    check (amount_micros > 0),

  created_at timestamptz not null default now()
);

create index if not exists billing_accounts_subscription_status_idx
  on public.billing_accounts(subscription_status);

create index if not exists billing_usage_reservations_user_status_idx
  on public.billing_usage_reservations(user_id, status);

create index if not exists billing_usage_reservations_created_at_idx
  on public.billing_usage_reservations(created_at);

create index if not exists billing_credit_events_user_created_at_idx
  on public.billing_credit_events(user_id, created_at desc);

create or replace function public.touch_billing_account_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists billing_accounts_touch_updated_at
  on public.billing_accounts;

create trigger billing_accounts_touch_updated_at
before update on public.billing_accounts
for each row
execute function public.touch_billing_account_updated_at();

insert into public.billing_accounts (
  user_id
)
select
  profiles.id
from public.profiles as profiles
on conflict (user_id) do nothing;

create or replace function public.create_billing_account_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.billing_accounts (
    user_id
  )
  values (
    new.id
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_create_billing_account
  on public.profiles;

create trigger profiles_create_billing_account
after insert on public.profiles
for each row
execute function public.create_billing_account_for_profile();

create or replace function public.reserve_billing_usage(
  p_reservation_id text,
  p_user_id uuid,
  p_conversation_id uuid,
  p_model_id text,
  p_amount_micros bigint
)
returns public.billing_usage_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.billing_accounts%rowtype;
  v_existing public.billing_usage_reservations%rowtype;
  v_reservation public.billing_usage_reservations%rowtype;

  v_stale_subscription_micros bigint := 0;
  v_stale_prepaid_micros bigint := 0;
  v_available_subscription_micros bigint := 0;

  v_funding_source text;
begin
  if p_reservation_id is null
    or length(trim(p_reservation_id)) = 0 then
    raise exception 'Reservation identifier is required.';
  end if;

  if p_amount_micros is null
    or p_amount_micros <= 0 then
    raise exception 'Reservation amount must be positive.';
  end if;

  select *
  into v_existing
  from public.billing_usage_reservations
  where id = p_reservation_id;

  if found then
    if v_existing.user_id <> p_user_id then
      raise exception 'Reservation identifier is already in use.';
    end if;

    return v_existing;
  end if;

  insert into public.billing_accounts (
    user_id
  )
  values (
    p_user_id
  )
  on conflict (user_id) do nothing;

  select *
  into v_account
  from public.billing_accounts
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Billing account could not be loaded.';
  end if;

  select
    coalesce(
      sum(reserved_micros),
      0
    )
  into v_stale_subscription_micros
  from public.billing_usage_reservations
  where user_id = p_user_id
    and status = 'reserved'
    and funding_source = 'subscription'
    and created_at < now() - interval '30 minutes';

  select
    coalesce(
      sum(reserved_micros),
      0
    )
  into v_stale_prepaid_micros
  from public.billing_usage_reservations
  where user_id = p_user_id
    and status = 'reserved'
    and funding_source = 'prepaid'
    and created_at < now() - interval '30 minutes';

  if v_stale_subscription_micros > 0 then
    update public.billing_accounts
    set used_usage_micros =
      greatest(
        0,
        used_usage_micros - v_stale_subscription_micros
      )
    where user_id = p_user_id;
  end if;

  if v_stale_prepaid_micros > 0 then
    update public.billing_accounts
    set prepaid_balance_micros =
      prepaid_balance_micros + v_stale_prepaid_micros
    where user_id = p_user_id;
  end if;

  update public.billing_usage_reservations
  set
    status = 'released',
    settled_at = now()
  where user_id = p_user_id
    and status = 'reserved'
    and created_at < now() - interval '30 minutes';

  select *
  into v_account
  from public.billing_accounts
  where user_id = p_user_id
  for update;

  if
    v_account.subscription_status in (
      'active',
      'trialing'
    )
    and (
      v_account.current_period_end is null
      or v_account.current_period_end > now()
    )
  then
    v_available_subscription_micros :=
      greatest(
        0,
        v_account.included_usage_micros
          - v_account.used_usage_micros
      );
  end if;

  if v_available_subscription_micros >= p_amount_micros then
    v_funding_source := 'subscription';

    update public.billing_accounts
    set used_usage_micros =
      used_usage_micros + p_amount_micros
    where user_id = p_user_id;

  elsif v_account.prepaid_balance_micros >= p_amount_micros then
    v_funding_source := 'prepaid';

    update public.billing_accounts
    set prepaid_balance_micros =
      prepaid_balance_micros - p_amount_micros
    where user_id = p_user_id;

  else
    return null;
  end if;

  insert into public.billing_usage_reservations (
    id,
    user_id,
    conversation_id,
    model_id,
    funding_source,
    reserved_micros,
    actual_micros,
    status,
    created_at,
    settled_at
  )
  values (
    p_reservation_id,
    p_user_id,
    p_conversation_id,
    p_model_id,
    v_funding_source,
    p_amount_micros,
    null,
    'reserved',
    now(),
    null
  )
  returning *
  into v_reservation;

  return v_reservation;
end;
$$;

create or replace function public.settle_billing_usage(
  p_reservation_id text,
  p_user_id uuid,
  p_actual_micros bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.billing_usage_reservations%rowtype;
  v_refund_micros bigint;
begin
  if p_actual_micros is null
    or p_actual_micros < 0 then
    return false;
  end if;

  select *
  into v_reservation
  from public.billing_usage_reservations
  where id = p_reservation_id
    and user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_reservation.status = 'settled' then
    return v_reservation.actual_micros = p_actual_micros;
  end if;

  if v_reservation.status <> 'reserved'
    or p_actual_micros > v_reservation.reserved_micros then
    return false;
  end if;

  perform 1
  from public.billing_accounts
  where user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  v_refund_micros :=
    v_reservation.reserved_micros - p_actual_micros;

  if v_reservation.funding_source = 'subscription' then
    update public.billing_accounts
    set used_usage_micros =
      greatest(
        0,
        used_usage_micros - v_refund_micros
      )
    where user_id = p_user_id;
  else
    update public.billing_accounts
    set prepaid_balance_micros =
      prepaid_balance_micros + v_refund_micros
    where user_id = p_user_id;
  end if;

  update public.billing_usage_reservations
  set
    actual_micros = p_actual_micros,
    status = 'settled',
    settled_at = now()
  where id = p_reservation_id
    and user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.release_billing_usage(
  p_reservation_id text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.billing_usage_reservations%rowtype;
begin
  select *
  into v_reservation
  from public.billing_usage_reservations
  where id = p_reservation_id
    and user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_reservation.status = 'released' then
    return true;
  end if;

  if v_reservation.status <> 'reserved' then
    return false;
  end if;

  perform 1
  from public.billing_accounts
  where user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_reservation.funding_source = 'subscription' then
    update public.billing_accounts
    set used_usage_micros =
      greatest(
        0,
        used_usage_micros - v_reservation.reserved_micros
      )
    where user_id = p_user_id;
  else
    update public.billing_accounts
    set prepaid_balance_micros =
      prepaid_balance_micros + v_reservation.reserved_micros
    where user_id = p_user_id;
  end if;

  update public.billing_usage_reservations
  set
    status = 'released',
    settled_at = now()
  where id = p_reservation_id
    and user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.update_billing_subscription(
  p_user_id uuid,
  p_plan_id text,
  p_subscription_status text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_included_usage_micros bigint,
  p_reset_period_usage boolean
)
returns public.billing_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.billing_accounts%rowtype;
begin
  if p_plan_id not in (
    'none',
    'starter',
    'plus',
    'pro'
  ) then
    raise exception 'Invalid billing plan.';
  end if;

  if p_subscription_status not in (
    'none',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid'
  ) then
    raise exception 'Invalid subscription status.';
  end if;

  if p_included_usage_micros is null
    or p_included_usage_micros < 0 then
    raise exception 'Included usage cannot be negative.';
  end if;

  insert into public.billing_accounts (
    user_id,
    plan_id,
    subscription_status,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    included_usage_micros,
    used_usage_micros
  )
  values (
    p_user_id,
    p_plan_id,
    p_subscription_status,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_current_period_start,
    p_current_period_end,
    p_included_usage_micros,
    0
  )
  on conflict (user_id)
  do update set
    plan_id = excluded.plan_id,
    subscription_status = excluded.subscription_status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    included_usage_micros = excluded.included_usage_micros,
    used_usage_micros =
      case
        when p_reset_period_usage then 0
        else public.billing_accounts.used_usage_micros
      end
  returning *
  into v_account;

  return v_account;
end;
$$;

create or replace function public.add_prepaid_billing_credit(
  p_user_id uuid,
  p_amount_micros bigint,
  p_external_reference text
)
returns public.billing_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_account public.billing_accounts%rowtype;
begin
  if p_amount_micros is null
    or p_amount_micros <= 0 then
    raise exception 'Credit amount must be positive.';
  end if;

  if p_external_reference is null
    or length(trim(p_external_reference)) = 0 then
    raise exception 'External payment reference is required.';
  end if;

  insert into public.billing_accounts (
    user_id
  )
  values (
    p_user_id
  )
  on conflict (user_id) do nothing;

  insert into public.billing_credit_events (
    user_id,
    external_reference,
    amount_micros
  )
  values (
    p_user_id,
    p_external_reference,
    p_amount_micros
  )
  on conflict (external_reference) do nothing
  returning id
  into v_event_id;

  if v_event_id is not null then
    update public.billing_accounts
    set prepaid_balance_micros =
      prepaid_balance_micros + p_amount_micros
    where user_id = p_user_id;
  end if;

  select *
  into v_account
  from public.billing_accounts
  where user_id = p_user_id;

  return v_account;
end;
$$;

alter table public.billing_accounts
  enable row level security;

alter table public.billing_usage_reservations
  enable row level security;

alter table public.billing_credit_events
  enable row level security;

drop policy if exists billing_accounts_select_own
  on public.billing_accounts;

create policy billing_accounts_select_own
on public.billing_accounts
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists billing_usage_reservations_select_own
  on public.billing_usage_reservations;

create policy billing_usage_reservations_select_own
on public.billing_usage_reservations
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists billing_credit_events_select_own
  on public.billing_credit_events;

create policy billing_credit_events_select_own
on public.billing_credit_events
for select
to authenticated
using (
  auth.uid() = user_id
);

revoke all
on function public.reserve_billing_usage(
  text,
  uuid,
  uuid,
  text,
  bigint
)
from public, anon, authenticated;

revoke all
on function public.settle_billing_usage(
  text,
  uuid,
  bigint
)
from public, anon, authenticated;

revoke all
on function public.release_billing_usage(
  text,
  uuid
)
from public, anon, authenticated;

revoke all
on function public.update_billing_subscription(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  bigint,
  boolean
)
from public, anon, authenticated;

revoke all
on function public.add_prepaid_billing_credit(
  uuid,
  bigint,
  text
)
from public, anon, authenticated;

grant execute
on function public.reserve_billing_usage(
  text,
  uuid,
  uuid,
  text,
  bigint
)
to service_role;

grant execute
on function public.settle_billing_usage(
  text,
  uuid,
  bigint
)
to service_role;

grant execute
on function public.release_billing_usage(
  text,
  uuid
)
to service_role;

grant execute
on function public.update_billing_subscription(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  bigint,
  boolean
)
to service_role;

grant execute
on function public.add_prepaid_billing_credit(
  uuid,
  bigint,
  text
)
to service_role;

commit;