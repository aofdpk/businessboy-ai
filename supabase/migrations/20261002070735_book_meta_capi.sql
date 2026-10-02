-- Default OFF. No historical orders are exported and consent fields are untouched.
create table public.book_meta_config (
 id boolean primary key default true check(id), enabled boolean not null default false,
 pixel_id text not null default '300488034391029' check(pixel_id='300488034391029'),
 lawful_basis text not null default 'pending' check(lawful_basis in ('pending','legitimate_interest')),
 notice_version text not null default 'book-meta-20261002-v1',
 review_reference text, reviewed_at timestamptz, enabled_at timestamptz,
 check(not enabled or (lawful_basis='legitimate_interest' and length(review_reference)>5 and reviewed_at is not null and enabled_at is not null))
);
insert into public.book_meta_config(id) values(true);
create table public.book_meta_context (
 order_id uuid primary key references public.book_orders(id) on delete cascade,
 phone_hash text check(phone_hash ~ '^[a-f0-9]{64}$'), user_agent text, fbc text,
 lawful_basis text not null check(lawful_basis='legitimate_interest'), notice_version text not null,
 objected boolean not null default false, created_at timestamptz not null default now()
);
create table public.book_meta_outbox (
 event_id text primary key, order_id uuid not null references public.book_orders(id) on delete cascade,
 event_name text not null check(event_name in ('OrderSubmitted','Purchase')),
 event_time timestamptz not null, amount integer not null check(amount>0),
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','skipped','expired')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 lock_id uuid, locked_at timestamptz, sent_at timestamptz, last_error text,
 unique(order_id,event_name)
);
create table public.book_meta_objections (
 order_id uuid primary key references public.book_orders(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index book_meta_due on public.book_meta_outbox(next_attempt_at) where status in ('pending','sending');
do $$ declare t text; begin
 foreach t in array array['book_meta_config','book_meta_context','book_meta_outbox','book_meta_objections'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.book_meta_enqueue(p_order uuid) returns void language plpgsql security invoker set search_path='' as $$
declare o public.book_orders; c public.book_meta_context; cfg public.book_meta_config; begin
 select * into cfg from public.book_meta_config where id;
 if not cfg.enabled or cfg.lawful_basis<>'legitimate_interest' then return; end if;
 select * into o from public.book_orders where id=p_order;
 select * into c from public.book_meta_context where order_id=p_order;
 if o.id is null or c.order_id is null or c.objected or c.phone_hash is null or o.is_test or
    o.created_at<cfg.enabled_at or c.notice_version<>cfg.notice_version or o.status in ('cancelled','returned') then return; end if;
 if o.created_at>now()-interval '6 days' then
  insert into public.book_meta_outbox(event_id,order_id,event_name,event_time,amount)
  values('book:'||o.id||':OrderSubmitted',o.id,'OrderSubmitted',o.created_at,o.amount) on conflict do nothing;
 end if;
 if o.payment_status in ('paid','cod_collected') and o.paid_at>now()-interval '6 days' then
  insert into public.book_meta_outbox(event_id,order_id,event_name,event_time,amount)
  values('book:'||o.id||':Purchase',o.id,'Purchase',o.paid_at,case when o.method='cod' then o.amount else o.base_amount end) on conflict do nothing;
 end if;
end $$;
create function public.book_meta_context_changed() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform public.book_meta_enqueue(new.order_id);return new;end $$;
create function public.book_meta_context_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.book_orders where id=new.order_id for update;
 if exists(select 1 from public.book_meta_objections where order_id=new.order_id) then
  new.objected:=true;new.phone_hash:=null;new.user_agent:=null;new.fbc:=null;
 end if;
 return new;
end $$;
create trigger book_meta_context_before before insert on public.book_meta_context for each row execute function public.book_meta_context_guard();
create trigger book_meta_context_insert after insert on public.book_meta_context for each row execute function public.book_meta_context_changed();
create function public.book_meta_order_changed() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- Measurement cannot roll back a payment/fulfillment action.
 begin perform public.book_meta_enqueue(new.id);exception when others then raise warning 'book_meta_enqueue_failed';end;
 return new;
end $$;
create trigger book_meta_payment_changed after update of payment_status on public.book_orders for each row execute function public.book_meta_order_changed();

create function public.book_meta_claim(p_limit integer default 10) returns setof public.book_meta_outbox language plpgsql security invoker set search_path='' as $$
begin
 update public.book_meta_outbox set status='failed',last_error='attempts_exhausted'
 where status='sending' and locked_at<now()-interval '5 minutes' and attempts>=10;
 update public.book_meta_outbox set status='expired',last_error='event_too_old'
 where status in ('pending','sending') and event_time<now()-interval '6 days';
 return query with picked as (
  select q.event_id from public.book_meta_outbox q
  where (q.status='pending' and q.next_attempt_at<=now() or q.status='sending' and q.locked_at<now()-interval '5 minutes')
  and q.attempts<10 order by q.event_time for update skip locked limit least(greatest(p_limit,1),10)
 ) update public.book_meta_outbox q set status='sending',attempts=q.attempts+1,locked_at=now(),lock_id=gen_random_uuid()
 from picked p where q.event_id=p.event_id returning q.*;
end $$;
create function public.book_meta_finish(p_event_id text,p_lock uuid,p_status text,p_error text default null) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_status not in ('sent','pending','failed','skipped') then raise exception 'invalid status';end if;
 update public.book_meta_outbox set status=case when p_status='pending' and attempts>=10 then 'failed' else p_status end,
 sent_at=case when p_status='sent' then now() else sent_at end,last_error=left(p_error,80),
 next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,attempts))::integer)),locked_at=null,lock_id=null
 where event_id=p_event_id and lock_id=p_lock and status='sending';
end $$;
create function public.book_meta_object(p_order uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.book_orders where id=p_order for update;
 insert into public.book_meta_objections(order_id) values(p_order) on conflict do nothing;
 update public.book_meta_context set objected=true,phone_hash=null,user_agent=null,fbc=null where order_id=p_order;
 update public.book_meta_outbox set status='skipped',last_error='customer_objected',lock_id=null,locked_at=null
 where order_id=p_order and status in ('pending','sending','failed');
end $$;

-- Secrets stay encrypted in Vault; this RPC is accessible to service_role only.
create function public.book_meta_secrets() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'worker_key',(select decrypted_secret from vault.decrypted_secrets where name='book_meta_worker_key' limit 1),
 'access_token',(select decrypted_secret from vault.decrypted_secrets where name='book_meta_access_token' limit 1))
$$;
revoke all on function public.book_meta_enqueue(uuid),public.book_meta_context_changed(),public.book_meta_context_guard(),public.book_meta_order_changed(),public.book_meta_claim(integer),public.book_meta_finish(text,uuid,text,text),public.book_meta_object(uuid),public.book_meta_secrets() from public,anon,authenticated;
grant execute on function public.book_meta_enqueue(uuid),public.book_meta_context_changed(),public.book_meta_context_guard(),public.book_meta_order_changed(),public.book_meta_claim(integer),public.book_meta_finish(text,uuid,text,text),public.book_meta_object(uuid),public.book_meta_secrets() to service_role;

create extension if not exists pg_net with schema extensions;
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'book_meta_worker_key');
-- No call leaves the database while disabled or without a CAPI token.
select cron.schedule('book-meta-dispatch','* * * * *',$cron$
 select net.http_post(
  url:='https://oezzgzzqgsrpvjeesgva.supabase.co/functions/v1/book-meta-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-book-worker-key',
   (select decrypted_secret from vault.decrypted_secrets where name='book_meta_worker_key' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=150000)
 where exists(select 1 from public.book_meta_config where enabled)
 and exists(select 1 from vault.secrets where name='book_meta_access_token')
 and exists(select 1 from public.book_meta_outbox where status='pending' and next_attempt_at<=now() or status='sending' and locked_at<now()-interval '5 minutes');
$cron$);
select cron.schedule('book-meta-cleanup','20 20 * * *',$cron$
 update public.book_meta_context set phone_hash=null,user_agent=null,fbc=null,objected=true where created_at<now()-interval '90 days' and not objected;
 delete from public.book_meta_outbox where event_time<now()-interval '90 days';
$cron$);
