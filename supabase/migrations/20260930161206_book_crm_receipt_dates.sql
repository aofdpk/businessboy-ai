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
 when 'delivery' then exists(select 1 from book_addons a where a.order_id=o.id and a.product<>'prompt_upgrade' and a.payment_status='paid' and a.delivery_status<>'sent')
 when 'new' then o.status='new' when 'shipped' then o.status='shipped' when 'delivered' then o.status='delivered' when 'cancelled' then o.status='cancelled' when 'returned' then o.status='returned' else true end),
 page_rows as (select * from filtered order by next_call_at asc nulls last,created_at desc limit 50 offset greatest(0,p_page)*50)
 select jsonb_build_object('orders',coalesce((select jsonb_agg((to_jsonb(o)-'idempotency_hash'-'slip_hash'-'slip_path')||jsonb_build_object('assignee',(select display_name from book_staff where user_id=o.assigned_to),'addons',coalesce((select jsonb_agg(to_jsonb(a)-'slip_hash'-'slip_path'-'activation_code') from book_addons a where a.order_id=o.id),'[]'::jsonb))) from page_rows o),'[]'::jsonb),'total',(select count(*) from filtered),
 'summary',(select jsonb_build_object('orders',count(*),'ready',count(*) filter(where status='ready' and batch_id is null),'calls',count(*) filter(where call_status in ('new','no_answer','interested') and status not in ('cancelled','returned')),'callbacks',count(*) filter(where call_status='callback' and next_call_at<=now()),'received',(select coalesce(sum(c.base_amount),0) from scoped c where c.payment_status in ('paid','cod_collected') and coalesce(c.paid_at,c.created_at)>=since_at),'ordered',coalesce(sum(base_amount) filter(where status not in ('cancelled','returned')),0),'pending_cod',coalesce(sum(amount) filter(where method='cod' and payment_status='cod_pending' and status not in ('cancelled','returned')),0)) from scoped where created_at>=since_at),
 'upsell',(select jsonb_build_object('agreed',coalesce(sum(a.amount) filter(where a.payment_status not in ('cancelled','refunded') and a.created_at>=since_at),0),'received',coalesce(sum(a.amount) filter(where a.payment_status='paid' and a.paid_at>=since_at),0),'count',count(*) filter(where a.payment_status not in ('cancelled','refunded') and a.created_at>=since_at)) from book_addons a join scoped o on o.id=a.order_id),
 'team',case when s.role='owner' then (select coalesce(jsonb_agg(x),'[]') from (select st.display_name,st.username,
 (select count(*) from book_audit au join book_orders bo on bo.id=au.order_id where au.actor=st.user_id and au.action='sales_call' and au.created_at>=since_at and not bo.is_test) calls,
 (select coalesce(sum(a.amount),0) from book_addons a join book_orders bo on bo.id=a.order_id where a.created_by=st.user_id and a.payment_status not in ('cancelled','refunded') and not bo.is_test and a.created_at>=since_at) agreed,
 (select coalesce(sum(a.amount),0) from book_addons a join book_orders bo on bo.id=a.order_id where a.created_by=st.user_id and a.payment_status='paid' and not bo.is_test and a.paid_at>=since_at) received
 from book_staff st where st.active and st.role in ('owner','telesales')) x) else '[]'::jsonb end) into result;
 return result;
end $$;
