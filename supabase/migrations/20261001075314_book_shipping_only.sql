-- Shipping-only launch mode. Re-enable only after a new explicit owner instruction.
alter table public.book_sales_settings add column telesales_enabled boolean not null default false;
update public.book_staff set active=false where role='telesales';
delete from public.book_sessions where user_id in (select user_id from public.book_staff where role='telesales');
insert into public.book_audit(action,details) values ('telesales_paused','{"reason":"owner requested shipping-only launch"}');

create or replace function public.book_crm(p_actor uuid,p_page integer default 0,p_view text default 'all',p_query text default '',p_days integer default 0) returns jsonb language plpgsql security invoker set search_path=public as $$
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
 when 'exported' then o.status='ready' and o.batch_id is not null
 when 'delivery' then exists(select 1 from book_addons a where a.order_id=o.id and a.product<>'prompt_upgrade' and a.payment_status='paid' and a.delivery_status<>'sent')
 when 'new' then o.status='new' when 'shipped' then o.status='shipped' when 'delivered' then o.status='delivered' when 'cancelled' then o.status='cancelled' when 'returned' then o.status='returned' else true end),
 page_rows as (select * from filtered order by next_call_at asc nulls last,created_at desc limit 50 offset greatest(0,p_page)*50)
 select jsonb_build_object('orders',coalesce((select jsonb_agg((to_jsonb(o)-'idempotency_hash'-'slip_hash'-'slip_path')||jsonb_build_object('assignee',(select display_name from book_staff where user_id=o.assigned_to),'addons',coalesce((select jsonb_agg(to_jsonb(a)-'slip_hash'-'slip_path'-'activation_code') from book_addons a where a.order_id=o.id),'[]'::jsonb))) from page_rows o),'[]'::jsonb),'total',(select count(*) from filtered),
 'summary',(select jsonb_build_object('orders',count(*),'ready',count(*) filter(where status='ready' and batch_id is null),'new',count(*) filter(where status='new'),'review',count(*) filter(where status='new' and payment_status='review'),'exported',count(*) filter(where status='ready' and batch_id is not null),'shipped',count(*) filter(where status in ('shipped','delivered')),'calls',count(*) filter(where call_status in ('new','no_answer','interested') and status not in ('cancelled','returned')),'callbacks',count(*) filter(where call_status='callback' and next_call_at<=now()),'received',(select coalesce(sum(c.base_amount),0) from scoped c where c.payment_status in ('paid','cod_collected') and coalesce(c.paid_at,c.created_at)>=since_at),'ordered',coalesce(sum(base_amount) filter(where status not in ('cancelled','returned')),0),'pending_cod',coalesce(sum(amount) filter(where method='cod' and payment_status='cod_pending' and status not in ('cancelled','returned')),0)) from scoped where created_at>=since_at),
 'upsell',(select jsonb_build_object('agreed',coalesce(sum(a.amount) filter(where a.payment_status not in ('cancelled','refunded') and a.created_at>=since_at),0),'received',coalesce(sum(a.amount) filter(where a.payment_status='paid' and a.paid_at>=since_at),0),'count',count(*) filter(where a.payment_status not in ('cancelled','refunded') and a.created_at>=since_at)) from book_addons a join scoped o on o.id=a.order_id),
 'team',case when s.role='owner' then (select coalesce(jsonb_agg(x),'[]') from (select st.display_name,st.username,
 (select count(*) from book_audit au join book_orders bo on bo.id=au.order_id where au.actor=st.user_id and au.action='sales_call' and au.created_at>=since_at and not bo.is_test) calls,
 (select coalesce(sum(a.amount),0) from book_addons a join book_orders bo on bo.id=a.order_id where a.created_by=st.user_id and a.payment_status not in ('cancelled','refunded') and not bo.is_test and a.created_at>=since_at) agreed,
 (select coalesce(sum(a.amount),0) from book_addons a join book_orders bo on bo.id=a.order_id where a.created_by=st.user_id and a.payment_status='paid' and not bo.is_test and a.paid_at>=since_at) received
 from book_staff st where st.active and st.role in ('owner','telesales')) x) else '[]'::jsonb end) into result;
 return result;
end $$;

create or replace function public.book_sales_action(p_id uuid,p_revision integer,p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare o book_orders; s book_staff; a book_addons; aid uuid; price integer; prod text; target uuid; begin
 if not coalesce((select telesales_enabled from book_sales_settings where id=true),false) then raise exception 'พักระบบเทเลและอัพเซลล์ไว้ชั่วคราว';end if;
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
