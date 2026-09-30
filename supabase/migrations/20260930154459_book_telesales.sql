-- Book CRM only. Prices confirmed by owner 2026-09-30.
alter table public.book_staff drop constraint book_staff_role_check;
alter table public.book_staff add constraint book_staff_role_check check(role in ('owner','finance','fulfillment','telesales'));
alter table public.book_staff add column username text unique check(username ~ '^[a-z0-9_]{3,40}$'), add column display_name text not null default '';
alter table public.book_orders add column base_amount integer, add column assigned_to uuid references public.book_staff(user_id), add column call_status text not null default 'new' check(call_status in ('new','no_answer','callback','interested','declined','sold','do_not_call')), add column next_call_at timestamptz, add column call_note text not null default '', add column call_count integer not null default 0, add column last_call_at timestamptz;
update public.book_orders set base_amount=amount;
alter table public.book_orders alter column base_amount set not null;
create function public.book_base_amount() returns trigger language plpgsql set search_path=public as $$ begin new.base_amount:=coalesce(new.base_amount,new.amount); return new; end $$;
create trigger book_base_amount before insert on public.book_orders for each row execute function public.book_base_amount();
create index book_orders_assignee on public.book_orders(assigned_to,created_at desc);
create index book_orders_callback on public.book_orders(next_call_at) where call_status='callback';

create table public.book_addons (
 id uuid primary key, order_id uuid not null references public.book_orders(id), created_at timestamptz not null default now(), created_by uuid not null references public.book_staff(user_id),
 product text not null check(product in ('prompt_upgrade','kcut_month','kcut_year','kcut_lifetime')),
 amount integer not null check((product='prompt_upgrade' and amount=145) or (product='kcut_month' and amount=390) or (product='kcut_year' and amount=3900) or (product='kcut_lifetime' and amount=5900)),
 method text not null check(method in ('transfer','cod')),
 payment_status text not null default 'awaiting_slip' check(payment_status in ('awaiting_slip','review','paid','cod_pending','cancelled','refunded')),
 delivery_status text not null default 'waiting_payment' check(delivery_status in ('waiting_payment','waiting_line','ready_to_send','sent','in_parcel')),
 line_name text not null default '', activation_code text not null default '', delivery_note text not null default '',
 slip_path text, slip_hash text unique, paid_at timestamptz, delivered_at timestamptz, revision integer not null default 0,
 check(method<>'cod' or product='prompt_upgrade')
);
create unique index book_addons_one_prompt on public.book_addons(order_id) where product='prompt_upgrade' and payment_status not in ('cancelled','refunded');
create unique index book_addons_one_kcut on public.book_addons(order_id) where product like 'kcut_%' and payment_status not in ('cancelled','refunded');
create index book_addons_creator on public.book_addons(created_by,created_at desc);
create table public.book_sales_settings(id boolean primary key default true check(id), line_url text not null default '', kcut_url text not null default '', kcut_guide_url text not null default '');
insert into public.book_sales_settings(id) values(true);
alter table public.book_addons enable row level security;
alter table public.book_sales_settings enable row level security;
revoke all on public.book_addons,public.book_sales_settings from anon,authenticated;
grant all on public.book_addons,public.book_sales_settings to service_role;

create function public.book_sales_action(p_id uuid,p_revision integer,p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare o book_orders; s book_staff; a book_addons; aid uuid; price integer; prod text; target uuid; begin
 select * into s from book_staff where user_id=p_actor and active;
 if s.role is null or s.role not in ('owner','telesales') then raise exception 'เฉพาะทีมโทรหรือเจ้าของ'; end if;
 select * into o from book_orders where id=p_id for update;
 if not found or o.revision<>p_revision then raise exception 'รายการเปลี่ยนแล้ว กรุณาเปิดใหม่'; end if;
 if p_action='claim' then
  if o.assigned_to is not null and o.assigned_to<>p_actor then raise exception 'มีผู้รับงานนี้แล้ว'; end if;
  if o.call_status='do_not_call' or o.status in ('cancelled','returned') then raise exception 'รายการนี้ไม่อยู่ในคิวโทร'; end if;
  o.assigned_to:=p_actor;
 elsif p_action='assign' then
  if s.role<>'owner' then raise exception 'เฉพาะเจ้าของแจกงานได้'; end if;
  target:=nullif(p_data->>'user_id','')::uuid;
  if target is not null and not exists(select 1 from book_staff where user_id=target and active and role in ('owner','telesales')) then raise exception 'ไม่พบพนักงาน'; end if;
  o.assigned_to:=target;
 else
  if s.role='telesales' and o.assigned_to is distinct from p_actor then raise exception 'รับงานนี้ก่อนทำรายการ'; end if;
  if p_action='call' then
   if p_data->>'status' not in ('no_answer','callback','interested','declined','sold','do_not_call') then raise exception 'เลือกผลการโทร'; end if;
   o.call_status:=p_data->>'status';o.call_note:=left(coalesce(p_data->>'note',''),1000);
   o.next_call_at:=case when o.call_status='callback' then nullif(p_data->>'next_call_at','')::timestamptz else null end;
   if o.call_status='callback' and (o.next_call_at is null or o.next_call_at<now()) then raise exception 'เลือกเวลานัดโทรในอนาคต'; end if;
   o.call_count:=o.call_count+1;o.last_call_at:=now();
  elsif p_action='addon' then
   if o.call_status='do_not_call' or o.status in ('cancelled','returned') then raise exception 'ไม่สามารถเพิ่มรายการนี้'; end if;
   prod:=p_data->>'product'; aid:=(p_data->>'id')::uuid;
   if exists(select 1 from book_addons where id=aid and order_id=p_id and product=prod) then return to_jsonb(o)-'idempotency_hash'-'slip_hash'-'slip_path'; end if;
   price:=case prod when 'prompt_upgrade' then 145 when 'kcut_month' then 390 when 'kcut_year' then 3900 when 'kcut_lifetime' then 5900 end;
   if price is null then raise exception 'ไม่พบสินค้า'; end if;
   if prod='prompt_upgrade' then
    if o.package<>'book' or o.batch_id is not null or o.status not in ('new','ready') then raise exception 'เพิ่มเว็บ Prompt ได้ก่อนส่งออกเท่านั้น และต้องเป็นแพ็ก 345'; end if;
    if o.method='transfer' and o.payment_status<>'paid' then raise exception 'ให้ฝ่ายการเงินตรวจรับยอดหนังสือ 345 บาทก่อน'; end if;
   end if;
   insert into book_addons(id,order_id,created_by,product,amount,method,payment_status,delivery_status)
    values(aid,p_id,p_actor,prod,price,case when prod='prompt_upgrade' and o.method='cod' then 'cod' else 'transfer' end,
    case when prod='prompt_upgrade' and o.method='cod' then 'cod_pending' else 'awaiting_slip' end,
    case when prod='prompt_upgrade' and o.method='cod' then 'in_parcel' else 'waiting_payment' end);
   if prod='prompt_upgrade' then
    if o.method='cod' then o.package:='bundle';o.amount:=490; else o.status:='new';end if;
   end if;
   o.call_status:='sold';o.next_call_at:=null;
  else raise exception 'ไม่พบคำสั่ง'; end if;
 end if;
 update book_orders set assigned_to=o.assigned_to,call_status=o.call_status,call_note=o.call_note,next_call_at=o.next_call_at,call_count=o.call_count,last_call_at=o.last_call_at,package=o.package,amount=o.amount,status=o.status,revision=revision+1,updated_at=now() where id=p_id returning * into o;
 insert into book_audit(actor,order_id,action,details) values(p_actor,p_id,'sales_'||p_action,case when p_action='addon' then jsonb_build_object('addon_id',aid,'product',prod,'amount',price) else p_data end);
 return to_jsonb(o)-'idempotency_hash'-'slip_hash'-'slip_path';
end $$;

create function public.book_addon_action(p_id uuid,p_revision integer,p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare a book_addons; o book_orders; s book_staff; oid uuid; begin
 select * into s from book_staff where user_id=p_actor and active;
 if s.role is null then raise exception 'ไม่มีสิทธิ์'; end if;
 select order_id into oid from book_addons where id=p_id;
 select * into o from book_orders where id=oid for update;
 select * into a from book_addons where id=p_id for update;
 if not found or a.revision<>p_revision then raise exception 'รายการเปลี่ยนแล้ว กรุณาเปิดใหม่';end if;
 if s.role='telesales' and o.assigned_to is distinct from p_actor then raise exception 'ไม่ใช่งานของคุณ';end if;
 if s.role='fulfillment' then raise exception 'ไม่มีสิทธิ์จัดการสินค้าเพิ่ม';end if;
 if p_action in ('paid','reject','refunded') and s.role not in ('owner','finance') then raise exception 'เฉพาะฝ่ายการเงิน';end if;
 if p_action='paid' then
  if a.payment_status<>'review' or a.slip_path is null or o.status in ('cancelled','returned') then raise exception 'ตรวจสลิปก่อนยืนยันยอด';end if;
  if a.product='prompt_upgrade' and (o.batch_id is not null or o.status not in ('new','ready')) then raise exception 'รายการส่งออกแล้ว ให้เจ้าของตรวจสอบ';end if;
  a.payment_status:='paid';a.paid_at:=now();a.delivery_status:=case when a.product='prompt_upgrade' then 'in_parcel' else 'waiting_line' end;
  if a.product='prompt_upgrade' then update book_orders set package='bundle',amount=490,status='ready',revision=revision+1,updated_at=now() where id=o.id;end if;
 elsif p_action='reject' then
  if a.payment_status<>'review' then raise exception 'ยังไม่มีสลิปรอตรวจ';end if;
  a.payment_status:='awaiting_slip';
 elsif p_action='cancel' then
  if s.role not in ('owner','telesales') or a.payment_status not in ('awaiting_slip','review','cod_pending') then raise exception 'ยกเลิกได้เฉพาะรายการยังไม่รับเงิน';end if;
  if a.product='prompt_upgrade' then
   if o.batch_id is not null or o.status not in ('new','ready') then raise exception 'ส่งออกแล้ว ยกเลิกส่วนเพิ่มไม่ได้';end if;
   update book_orders set package='book',amount=345,status=case when method='transfer' and payment_status='paid' then 'ready' else status end,revision=revision+1,updated_at=now() where id=o.id;
  end if;
  a.payment_status:='cancelled';
 elsif p_action='delivery' then
  if s.role not in ('owner','telesales') or a.product='prompt_upgrade' or a.payment_status<>'paid' then raise exception 'รับเงิน KCUT ก่อนส่งสิทธิ์';end if;
  if p_data->>'status' not in ('waiting_line','ready_to_send','sent') then raise exception 'เลือกสถานะส่งสิทธิ์';end if;
  if a.delivery_status='sent' then raise exception 'ส่งสิทธิ์แล้ว หากต้องแก้ไขให้ติดต่อเจ้าของ';end if;
  a.line_name:=left(coalesce(p_data->>'line_name',''),150);a.activation_code:=left(coalesce(p_data->>'code',''),500);a.delivery_note:=left(coalesce(p_data->>'note',''),1000);
  a.delivery_status:=p_data->>'status';
  if a.delivery_status='sent' and (a.line_name='' or a.activation_code='') then raise exception 'กรอกชื่อ LINE และโค้ดที่ส่งก่อน';end if;
  if a.delivery_status='sent' then a.delivered_at:=now();end if;
 elsif p_action='refunded' then
  if a.payment_status<>'paid' then raise exception 'ยังไม่ได้รับเงิน';end if;
  if a.product='prompt_upgrade' then raise exception 'คืนส่วนเพิ่ม Prompt ต้องให้เจ้าของตรวจรายการหนังสือก่อน';end if;
  if length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'กรอกเหตุผลคืนเงินและผลการยกเลิกสิทธิ์';end if;
  a.payment_status:='refunded';a.delivery_note:=left(p_data->>'note',1000);
 else raise exception 'ไม่พบคำสั่ง';end if;
 update book_addons set payment_status=a.payment_status,delivery_status=a.delivery_status,line_name=a.line_name,activation_code=a.activation_code,delivery_note=a.delivery_note,paid_at=a.paid_at,delivered_at=a.delivered_at,revision=revision+1 where id=p_id returning * into a;
 insert into book_audit(actor,order_id,action,details) values(p_actor,o.id,'addon_'||p_action,jsonb_build_object('addon_id',a.id,'product',a.product,'amount',a.amount,'delivery_status',a.delivery_status));
 return to_jsonb(a)-'slip_hash'-'slip_path';
end $$;

-- Keep COD collection and addon revenue in the same transaction.
create function public.book_sync_addons() returns trigger language plpgsql set search_path=public as $$ begin
 if new.payment_status='cod_collected' and old.payment_status is distinct from new.payment_status then
 update book_addons set payment_status='paid',paid_at=new.paid_at,revision=revision+1 where order_id=new.id and method='cod' and payment_status='cod_pending';
 end if;
 if new.status in ('cancelled','returned') and new.status is distinct from old.status then
 update book_addons set payment_status='cancelled',revision=revision+1 where order_id=new.id and payment_status in ('awaiting_slip','review','cod_pending');
 end if;
 if new.payment_status='refunded' and old.payment_status is distinct from new.payment_status then
 update book_addons set payment_status='refunded',revision=revision+1 where order_id=new.id and method='cod' and payment_status='paid';
 end if;
 return new;
end $$;
create trigger book_sync_addons after update on public.book_orders for each row execute function public.book_sync_addons();

create function public.book_crm(p_actor uuid,p_page integer default 0,p_view text default 'all',p_query text default '',p_days integer default 0) returns jsonb language plpgsql security invoker set search_path=public as $$
declare s book_staff; result jsonb; since_at timestamptz; begin
 select * into s from book_staff where user_id=p_actor and active;
 if s.role is null then raise exception 'ไม่มีสิทธิ์';end if;
 since_at:=case when p_days>0 then (date_trunc('day',now() at time zone 'Asia/Bangkok')-(least(p_days,366)-1)*interval '1 day') at time zone 'Asia/Bangkok' else '-infinity'::timestamptz end;
 with scoped as (select o.* from book_orders o where not o.is_test and (s.role<>'telesales' or o.assigned_to=p_actor or (p_view='unassigned' and o.assigned_to is null and o.call_status<>'do_not_call' and o.status not in ('cancelled','returned')))),
 filtered as (select * from scoped o where o.created_at>=since_at and
 (p_query='' or concat_ws(' ',o.first_name,o.last_name,o.phone,o.tracking,'BB'||lpad(o.number::text,6,'0')) ilike '%'||replace(replace(left(p_query,100),'%','\%'),'_','\_')||'%') and
 case p_view when 'unassigned' then o.assigned_to is null and o.call_status<>'do_not_call' and o.status not in ('cancelled','returned')
 when 'calls' then o.assigned_to is not null and o.call_status in ('new','no_answer','interested') and o.status not in ('cancelled','returned')
 when 'callback' then o.call_status='callback' and o.next_call_at<=now()
 when 'finance' then o.payment_status='review' or exists(select 1 from book_addons a where a.order_id=o.id and a.payment_status='review')
 when 'ready' then o.status='ready' and o.batch_id is null
 when 'delivery' then exists(select 1 from book_addons a where a.order_id=o.id and a.product<>'prompt_upgrade' and a.payment_status='paid' and a.delivery_status<>'sent')
 when 'new' then o.status='new' when 'shipped' then o.status='shipped' when 'delivered' then o.status='delivered' when 'cancelled' then o.status='cancelled' when 'returned' then o.status='returned' else true end),
 page_rows as (select * from filtered order by next_call_at asc nulls last,created_at desc limit 50 offset greatest(0,p_page)*50)
 select jsonb_build_object('orders',coalesce((select jsonb_agg((to_jsonb(o)-'idempotency_hash'-'slip_hash'-'slip_path')||jsonb_build_object('assignee',(select display_name from book_staff where user_id=o.assigned_to),'addons',coalesce((select jsonb_agg(to_jsonb(a)-'slip_hash'-'slip_path'-'activation_code') from book_addons a where a.order_id=o.id),'[]'::jsonb))) from page_rows o),'[]'::jsonb),'total',(select count(*) from filtered),
 'summary',(select jsonb_build_object('orders',count(*),'ready',count(*) filter(where status='ready' and batch_id is null),'calls',count(*) filter(where call_status in ('new','no_answer','interested') and status not in ('cancelled','returned')),'callbacks',count(*) filter(where call_status='callback' and next_call_at<=now()),'received',coalesce(sum(base_amount) filter(where payment_status in ('paid','cod_collected')),0),'ordered',coalesce(sum(base_amount) filter(where status not in ('cancelled','returned')),0),'pending_cod',coalesce(sum(amount) filter(where method='cod' and payment_status='cod_pending' and status not in ('cancelled','returned')),0)) from scoped where created_at>=since_at),
 'upsell',(select jsonb_build_object('agreed',coalesce(sum(a.amount) filter(where a.payment_status not in ('cancelled','refunded')),0),'received',coalesce(sum(a.amount) filter(where a.payment_status='paid'),0),'count',count(*) filter(where a.payment_status not in ('cancelled','refunded'))) from book_addons a join scoped o on o.id=a.order_id where a.created_at>=since_at),
 'team',case when s.role='owner' then (select coalesce(jsonb_agg(x),'[]') from (select st.display_name,st.username,
 (select count(*) from book_audit au join book_orders bo on bo.id=au.order_id where au.actor=st.user_id and au.action='sales_call' and au.created_at>=since_at and not bo.is_test) calls,
 (select coalesce(sum(a.amount),0) from book_addons a join book_orders bo on bo.id=a.order_id where a.created_by=st.user_id and a.payment_status not in ('cancelled','refunded') and not bo.is_test and a.created_at>=since_at) agreed,
 (select coalesce(sum(a.amount),0) from book_addons a join book_orders bo on bo.id=a.order_id where a.created_by=st.user_id and a.payment_status='paid' and not bo.is_test and a.created_at>=since_at) received
 from book_staff st where st.active and st.role in ('owner','telesales')) x) else '[]'::jsonb end) into result;
 return result;
end $$;
revoke all on function public.book_sales_action(uuid,integer,uuid,text,jsonb), public.book_addon_action(uuid,integer,uuid,text,jsonb), public.book_crm(uuid,integer,text,text,integer),public.book_base_amount(),public.book_sync_addons() from public,anon,authenticated;
grant execute on function public.book_sales_action(uuid,integer,uuid,text,jsonb),public.book_addon_action(uuid,integer,uuid,text,jsonb),public.book_crm(uuid,integer,text,text,integer),public.book_base_amount(),public.book_sync_addons() to service_role;

create table public.book_receipt_hashes(hash text primary key,owner_id uuid not null);
alter table public.book_receipt_hashes enable row level security;
revoke all on public.book_receipt_hashes from anon,authenticated;
grant all on public.book_receipt_hashes to service_role;
insert into public.book_receipt_hashes(hash,owner_id) select slip_hash,id from book_orders where slip_hash is not null;
create function public.book_unique_receipt() returns trigger language plpgsql set search_path=public as $$ declare target uuid;begin
 if new.slip_hash is not null then
  insert into book_receipt_hashes(hash,owner_id) values(new.slip_hash,new.id) on conflict(hash) do nothing;
  select owner_id into target from book_receipt_hashes where hash=new.slip_hash;
  if target<>new.id then raise exception 'สลิปนี้ใช้กับรายการอื่นแล้ว';end if;
 end if;return new;end $$;
create trigger book_order_receipt before insert or update of slip_hash on public.book_orders for each row execute function public.book_unique_receipt();
create trigger book_addon_receipt before insert or update of slip_hash on public.book_addons for each row execute function public.book_unique_receipt();
create function public.book_addon_slip(p_id uuid,p_revision integer,p_path text,p_hash text) returns void language plpgsql security invoker set search_path=public as $$
declare a book_addons;o book_orders;oid uuid;begin
 select order_id into oid from book_addons where id=p_id;
 select * into o from book_orders where id=oid for update;
 select * into a from book_addons where id=p_id for update;
 if not found or a.revision<>p_revision or a.method<>'transfer' or a.payment_status not in ('awaiting_slip','review') or o.status in ('cancelled','returned') then raise exception 'รายการเปลี่ยนแล้ว กรุณาเปิดใหม่';end if;
 update book_addons set slip_path=p_path,slip_hash=p_hash,payment_status='review',revision=revision+1 where id=p_id;
 insert into book_audit(order_id,action,details) values(oid,'addon_slip_uploaded',jsonb_build_object('addon_id',p_id));
end $$;
revoke all on function public.book_unique_receipt(),public.book_addon_slip(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.book_unique_receipt(),public.book_addon_slip(uuid,integer,text,text) to service_role;

create or replace function public.book_change(p_id uuid,p_revision integer,p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare o book_orders; r text; begin
 select role into r from book_staff where user_id=p_actor and active;
 if r is null or r='telesales' then raise exception 'ไม่มีสิทธิ์'; end if;
 select * into o from book_orders where id=p_id for update;
 if not found or o.revision<>p_revision then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่'; end if;
 if p_action in ('ready','shipped','delivered','returned','edit') and r not in ('owner','fulfillment') then raise exception 'เฉพาะฝ่ายจัดส่ง'; end if;
 if p_action in ('paid','cod_collected','refunded') and r not in ('owner','finance') then raise exception 'เฉพาะฝ่ายการเงิน'; end if;
 if p_action in ('paid','ready','shipped') and exists(select 1 from book_addons where order_id=p_id and product='prompt_upgrade' and method='transfer' and payment_status in ('awaiting_slip','review')) then raise exception 'รอรับส่วนต่างเว็บ Prompt หรือยกเลิกส่วนเพิ่มก่อน';end if;
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
  if exists(select 1 from book_addons where order_id=p_id and product='prompt_upgrade' and method='transfer' and payment_status='paid') then raise exception 'มีส่วนต่าง Prompt ที่รับแล้ว ให้เจ้าของตรวจการคืนเงินทั้งสองรายการ';end if;
  if o.payment_status not in ('paid','cod_collected') or o.status not in ('cancelled','returned') then raise exception 'ต้องยกเลิกหรือคืนสินค้าก่อน'; end if;o.payment_status:='refunded';
 elsif p_action='edit' then
  if o.batch_id is not null or o.status not in ('new','ready') then raise exception 'แก้ที่อยู่ได้ก่อนส่งออกเท่านั้น'; end if;
  o.first_name:=p_data->>'first_name';o.last_name:=p_data->>'last_name';o.phone:=p_data->>'phone';o.address:=p_data->>'address';o.subdistrict:=p_data->>'subdistrict';o.district:=p_data->>'district';o.province:=p_data->>'province';o.postcode:=p_data->>'postcode';o.note:=coalesce(p_data->>'note','');
 else raise exception 'คำสั่งไม่รองรับ';end if;
 update book_orders set first_name=o.first_name,last_name=o.last_name,phone=o.phone,address=o.address,subdistrict=o.subdistrict,district=o.district,province=o.province,postcode=o.postcode,note=o.note,status=o.status,payment_status=o.payment_status,paid_at=o.paid_at,tracking=o.tracking,revision=revision+1,updated_at=now() where id=p_id returning * into o;
 insert into book_audit(actor,order_id,action) values(p_actor,p_id,p_action);
 return to_jsonb(o)-'idempotency_hash'-'slip_hash';
end $$;


create or replace function public.book_export(p_id uuid,p_ids uuid[],p_actor uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare snap jsonb; n integer; begin
 if not exists(select 1 from book_staff where user_id=p_actor and active and role in ('owner','fulfillment')) then raise exception 'เฉพาะฝ่ายจัดส่ง';end if;
 perform pg_advisory_xact_lock(9302026);
 select snapshot into snap from book_exports where id=p_id;
 if found then return jsonb_build_object('id',p_id,'orders',snap); end if;
 if coalesce(array_length(p_ids,1),0) not between 1 and 500 then raise exception 'เลือก 1 ถึง 500 ออเดอร์'; end if;
 perform 1 from book_orders where id=any(p_ids) for update;
 select count(*),jsonb_agg(to_jsonb(o) - 'idempotency_hash' - 'slip_hash' - 'slip_path' order by number) into n,snap from book_orders o
 where id=any(p_ids) and status='ready' and batch_id is null and not is_test and not exists(select 1 from book_addons a where a.order_id=o.id and a.product='prompt_upgrade' and a.method='transfer' and a.payment_status in ('awaiting_slip','review')) and (payment_status='paid' or (method='cod' and payment_status='cod_pending'));
 if n<>cardinality(p_ids) then raise exception 'รายการเปลี่ยนแปลง หรือเคยส่งออกแล้ว กรุณาโหลดใหม่'; end if;
 insert into book_exports(id,created_by,snapshot) values(p_id,p_actor,snap);
 update book_orders set batch_id=p_id,revision=revision+1,updated_at=now() where id=any(p_ids);
 insert into book_audit(actor,action,details) values(p_actor,'export',jsonb_build_object('batch',p_id,'count',n));
 return jsonb_build_object('id',p_id,'orders',snap);
end $$;


create or replace function public.book_metrics() returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
 'orders',(select jsonb_build_object('count',count(*),'ordered',coalesce(sum(base_amount) filter(where status<>'cancelled'),0),'received',coalesce(sum(base_amount) filter(where payment_status in ('paid','cod_collected')),0),'pending_cod',coalesce(sum(base_amount) filter(where method='cod' and payment_status='cod_pending' and status not in ('cancelled','returned')),0)) from book_orders where not is_test),
 'events',(select coalesce(jsonb_agg(x),'[]') from (select event,count(*) hits,count(distinct session_id) visitors from book_events where created_at>now()-interval '30 days' group by event) x),
 'engagement',(select coalesce(round(avg((data->>'seconds')::numeric)),0) from book_events where event='engagement' and created_at>now()-interval '30 days'),
 'sources',(select coalesce(jsonb_agg(x),'[]') from (select utm->>'utm_source' source,utm->>'utm_campaign' campaign,count(*) orders,coalesce(sum(base_amount),0) ordered,coalesce(sum(base_amount) filter(where payment_status in ('paid','cod_collected')),0) received from book_orders where not is_test and status<>'cancelled' group by 1,2 order by count(*) desc limit 50) x)
 ); $$;
