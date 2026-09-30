create table public.book_private_settings(id boolean primary key default true check(id),prompt_code text not null default '');
alter table public.book_private_settings enable row level security;
revoke all on public.book_private_settings from anon,authenticated;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'book\_%' escape '\' loop
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for t in select sequencename from pg_sequences where schemaname='public' and sequencename like 'book\_%' escape '\' loop
  execute format('grant usage,select on sequence public.%I to service_role',t);
 end loop;
end $$;
create index book_sessions_expiry on public.book_sessions(expires_at);
create index book_rate_expiry on public.book_rate_limits(expires_at);
