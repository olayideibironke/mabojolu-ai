-- Security hardening for database trigger helpers.
--
-- These SECURITY DEFINER functions are invoked by Postgres triggers/event
-- triggers. Browser roles do not need direct RPC execution rights.

revoke execute
on function public.create_billing_account_for_profile()
from public, anon, authenticated;

grant execute
on function public.create_billing_account_for_profile()
to service_role;

revoke execute
on function public.handle_new_user()
from public, anon, authenticated;

grant execute
on function public.handle_new_user()
to service_role;

revoke execute
on function public.rls_auto_enable()
from public, anon, authenticated;

grant execute
on function public.rls_auto_enable()
to service_role;
