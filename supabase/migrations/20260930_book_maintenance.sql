alter table public.book_exports add column is_test boolean not null default false;
create or replace function public.book_maintenance() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from book_rate_limits where expires_at<now()-interval '1 day';
 delete from book_sessions where expires_at<now();
 delete from book_events where created_at<now()-interval '90 days';
 delete from book_setup where expires_at<now();
end $$;
revoke all on function public.book_maintenance() from public,anon,authenticated;
grant execute on function public.book_maintenance() to service_role;
