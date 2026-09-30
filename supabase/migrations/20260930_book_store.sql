-- Dedicated book store. Existing salepage and chatbot tables are unchanged.
create table public.book_staff (user_id uuid primary key references auth.users(id), email text unique not null, role text not null check(role in ('owner','finance','fulfillment')), active boolean not null default true);
create table public.book_sessions (token_hash text primary key, user_id uuid not null references public.book_staff(user_id), expires_at timestamptz not null);
create table public.book_settings (id boolean primary key default true check(id), ga4_id text not null default '', pixel_id text not null default '', clarity_id text not null default '');
insert into public.book_settings(id) values(true);
create table public.book_rate_limits (key text primary key, count integer not null default 1, expires_at timestamptz not null);
create table public.book_orders (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 0,
 idempotency_hash text unique not null, package text not null check(package in ('book','bundle')),
 amount integer not null check((package='book' and amount=345) or (package='bundle' and amount=490)),
 first_name text not null,last_name text not null,phone text not null,address text not null,
 subdistrict text not null,district text not null,province text not null,postcode text not null check(postcode ~ '^[0-9]{5}$'),note text not null default '',
 method text not null check(method in ('transfer','cod')),
 payment_status text not null check(payment_status in ('awaiting_slip','review','paid','cod_pending','cod_collected','refunded')),
 status text not null default 'new' check(status in ('new','ready','shipped','delivered','cancelled','returned')),
 slip_path text,slip_hash text, batch_id uuid,tracking text, paid_at timestamptz,
 utm jsonb not null default '{}',analytics_consent boolean not null default false, marketing_consent boolean not null default false,
 session_id uuid, is_test boolean not null default false
);
create index book_orders_queue on public.book_orders(status,created_at desc);
create index book_orders_batch on public.book_orders(batch_id) where batch_id is not null;
create unique index book_unique_slip on public.book_orders(slip_hash) where slip_hash is not null;
create table public.book_exports (id uuid primary key,created_at timestamptz not null default now(),created_by uuid not null references public.book_staff(user_id),snapshot jsonb not null);
create table public.book_audit (id bigint generated always as identity primary key,created_at timestamptz not null default now(),actor uuid,order_id uuid,action text not null,details jsonb not null default '{}');
create index book_audit_order on public.book_audit(order_id,created_at desc);
create table public.book_events (id uuid primary key,event text not null,session_id uuid not null,created_at timestamptz not null default now(),data jsonb not null default '{}',utm jsonb not null default '{}');
create index book_events_created on public.book_events(created_at desc);
create table public.book_setup (token_hash text primary key,expires_at timestamptz not null);
do $$ declare t text; begin
 foreach t in array array['book_staff','book_sessions','book_settings','book_rate_limits','book_orders','book_exports','book_audit','book_events','book_setup'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('book-slips','book-slips',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;

create function public.book_rate(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; begin
 insert into book_rate_limits(key,count,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set count=case when book_rate_limits.expires_at<now() then 1 else book_rate_limits.count+1 end,
 expires_at=case when book_rate_limits.expires_at<now() then now()+make_interval(secs=>p_seconds) else book_rate_limits.expires_at end returning count into n;
 return n<=p_limit;
end $$;

create function public.book_export(p_id uuid,p_ids uuid[],p_actor uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare snap jsonb; n integer; begin
 perform pg_advisory_xact_lock(9302026);
 select snapshot into snap from book_exports where id=p_id;
 if found then return jsonb_build_object('id',p_id,'orders',snap); end if;
 if coalesce(array_length(p_ids,1),0) not between 1 and 500 then raise exception 'เลือก 1 ถึง 500 ออเดอร์'; end if;
 perform 1 from book_orders where id=any(p_ids) for update;
 select count(*),jsonb_agg(to_jsonb(o) - 'idempotency_hash' - 'slip_hash' - 'slip_path' order by number) into n,snap from book_orders o
 where id=any(p_ids) and status='ready' and batch_id is null and not is_test and (payment_status='paid' or (method='cod' and payment_status='cod_pending'));
 if n<>cardinality(p_ids) then raise exception 'รายการเปลี่ยนแปลง หรือเคยส่งออกแล้ว กรุณาโหลดใหม่'; end if;
 insert into book_exports(id,created_by,snapshot) values(p_id,p_actor,snap);
 update book_orders set batch_id=p_id,revision=revision+1,updated_at=now() where id=any(p_ids);
 insert into book_audit(actor,action,details) values(p_actor,'export',jsonb_build_object('batch',p_id,'count',n));
 return jsonb_build_object('id',p_id,'orders',snap);
end $$;

create function public.book_change(p_id uuid,p_revision integer,p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare o book_orders; r text; begin
 select role into r from book_staff where user_id=p_actor and active;
 if r is null then raise exception 'ไม่มีสิทธิ์'; end if;
 select * into o from book_orders where id=p_id for update;
 if not found or o.revision<>p_revision then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่'; end if;
 if p_action in ('paid','cod_collected','refunded') and r not in ('owner','finance') then raise exception 'เฉพาะฝ่ายการเงิน'; end if;
 if p_action='paid' then
  if o.method<>'transfer' or o.payment_status<>'review' or o.slip_path is null or o.status<>'new' then raise exception 'ยังยืนยันเงินไม่ได้'; end if;
  o.payment_status:='paid';o.paid_at:=now();o.status:='ready';
 elsif p_action='reject_slip' then
  if r not in ('owner','finance') or o.payment_status<>'review' or o.status<>'new' then raise exception 'ยังปฏิเสธสลิปไม่ได้'; end if;
  o.payment_status:='awaiting_slip';
 elsif p_action='ready' then
  if o.method<>'cod' or o.status<>'new' then raise exception 'ยังยืนยันออเดอร์ไม่ได้'; end if; o.status:='ready';
 elsif p_action='shipped' then
  if o.status<>'ready' or o.batch_id is null or length(trim(coalesce(p_data->>'tracking',''))) not between 5 and 60 then raise exception 'ต้องส่งออกและกรอกเลขพัสดุก่อน'; end if;
  o.status:='shipped';o.tracking:=trim(p_data->>'tracking');
 elsif p_action='delivered' then
  if o.status<>'shipped' then raise exception 'ยังส่งไม่สำเร็จ'; end if; o.status:='delivered';
 elsif p_action='cod_collected' then
  if o.method<>'cod' or o.payment_status<>'cod_pending' or o.status<>'delivered' then raise exception 'ต้องส่งสำเร็จก่อนยืนยันยอดรับจาก DHL'; end if;
  o.payment_status:='cod_collected';o.paid_at:=now();
 elsif p_action='cancelled' then
  if o.status not in ('new','ready') or o.batch_id is not null then raise exception 'รายการส่งออกแล้ว ต้องตรวจสอบกับทีมส่งก่อน'; end if; o.status:='cancelled';
 elsif p_action='returned' then
  if o.status not in ('shipped','delivered') then raise exception 'สถานะไม่รองรับ'; end if;o.status:='returned';
 elsif p_action='refunded' then
  if o.payment_status not in ('paid','cod_collected') or o.status not in ('cancelled','returned') then raise exception 'ต้องยกเลิกหรือคืนสินค้าก่อน'; end if;o.payment_status:='refunded';
 elsif p_action='edit' then
  if o.batch_id is not null or o.status not in ('new','ready') then raise exception 'แก้ที่อยู่ได้ก่อนส่งออกเท่านั้น'; end if;
  o.first_name:=p_data->>'first_name';o.last_name:=p_data->>'last_name';o.phone:=p_data->>'phone';o.address:=p_data->>'address';o.subdistrict:=p_data->>'subdistrict';o.district:=p_data->>'district';o.province:=p_data->>'province';o.postcode:=p_data->>'postcode';o.note:=coalesce(p_data->>'note','');
 else raise exception 'คำสั่งไม่รองรับ';end if;
 update book_orders set first_name=o.first_name,last_name=o.last_name,phone=o.phone,address=o.address,subdistrict=o.subdistrict,district=o.district,province=o.province,postcode=o.postcode,note=o.note,status=o.status,payment_status=o.payment_status,paid_at=o.paid_at,tracking=o.tracking,revision=revision+1,updated_at=now() where id=p_id returning * into o;
 insert into book_audit(actor,order_id,action) values(p_actor,p_id,p_action);
 return to_jsonb(o)-'idempotency_hash'-'slip_hash';
end $$;

create function public.book_metrics() returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
 'orders',(select jsonb_build_object('count',count(*),'ordered',coalesce(sum(amount) filter(where status<>'cancelled'),0),'received',coalesce(sum(amount) filter(where payment_status in ('paid','cod_collected')),0),'pending_cod',coalesce(sum(amount) filter(where method='cod' and payment_status='cod_pending' and status not in ('cancelled','returned')),0)) from book_orders where not is_test),
 'events',(select coalesce(jsonb_agg(x),'[]') from (select event,count(*) hits,count(distinct session_id) visitors from book_events where created_at>now()-interval '30 days' group by event) x),
 'engagement',(select coalesce(round(avg((data->>'seconds')::numeric)),0) from book_events where event='engagement' and created_at>now()-interval '30 days'),
 'sources',(select coalesce(jsonb_agg(x),'[]') from (select utm->>'utm_source' source,utm->>'utm_campaign' campaign,count(*) orders,coalesce(sum(amount),0) ordered,coalesce(sum(amount) filter(where payment_status in ('paid','cod_collected')),0) received from book_orders where not is_test and status<>'cancelled' group by 1,2 order by count(*) desc limit 50) x)
 ); $$;
revoke all on function public.book_rate(text,integer,integer), public.book_export(uuid,uuid[],uuid), public.book_change(uuid,integer,uuid,text,jsonb),public.book_metrics() from public,anon,authenticated;
grant execute on function public.book_rate(text,integer,integer),public.book_export(uuid,uuid[],uuid),public.book_change(uuid,integer,uuid,text,jsonb),public.book_metrics() to service_role;
