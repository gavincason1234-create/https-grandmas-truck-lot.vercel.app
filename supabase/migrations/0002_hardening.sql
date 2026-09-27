-- Hardening flagged by the Supabase security linter after 0001.

-- Trigger functions should not be callable through the REST API at all.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;

-- Pin search_path so a malicious schema can't shadow the objects these functions touch.
alter function public.set_updated_at() set search_path = public;
alter function public.protect_profile_role() set search_path = public;
alter function public.handle_new_user() set search_path = public;
