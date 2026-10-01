alter table public.book_orders add column refunded_at timestamptz, add column payment_note text not null default '';
update public.book_orders o set refunded_at=coalesce((select max(created_at) from book_audit a where a.order_id=o.id and a.action='refunded'),o.updated_at) where payment_status='refunded';
create or replace function public.book_change(p_id uuid,p_revision integer,p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare o book_orders; r text; begin
 select role into r from book_staff where user_id=p_actor and active;
 if r='finance' and p_action not in ('paid','reject_slip','cod_collected','refunded') then raise exception 'เฉพาะงานการเงิน';end if;
 if r is null or r='telesales' then raise exception 'ไม่มีสิทธิ์'; end if;
 select * into o from book_orders where id=p_id for update;
 if not found or o.revision<>p_revision then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่'; end if;
 if p_action in ('ready','shipped','delivered','returned','edit') and r not in ('owner','fulfillment') then raise exception 'เฉพาะฝ่ายจัดส่ง'; end if;
 if p_action in ('paid','cod_collected','refunded') and r not in ('owner','finance') then raise exception 'เฉพาะฝ่ายการเงิน'; end if;
 if p_action in ('paid','ready','shipped') and exists(select 1 from book_addons where order_id=p_id and product='prompt_upgrade' and method='transfer' and payment_status in ('awaiting_slip','review')) then raise exception 'รอรับส่วนต่างเว็บ Prompt หรือยกเลิกส่วนเพิ่มก่อน';end if;
 if p_action='paid' then
  if o.method<>'transfer' or o.payment_status<>'review' or o.slip_path is null or o.status<>'new' then raise exception 'ยังยืนยันเงินไม่ได้'; end if;
  o.payment_note:='';o.payment_status:='paid';o.paid_at:=now();o.status:='ready';
 elsif p_action='reject_slip' then
  if r not in ('owner','finance') or o.payment_status<>'review' or o.status<>'new' then raise exception 'ยังปฏิเสธสลิปไม่ได้'; end if;
  if length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'กรอกเหตุผลที่ให้แนบสลิปใหม่';end if;
  o.payment_note:=left(trim(p_data->>'note'),500);o.payment_status:='awaiting_slip';
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
  if o.payment_status not in ('paid','cod_collected') or o.status not in ('cancelled','returned') then raise exception 'ต้องยกเลิกหรือคืนสินค้าก่อน'; end if;
  if length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'กรอกเหตุผลคืนเงิน';end if;
  o.payment_note:=left(trim(p_data->>'note'),500);o.refunded_at:=now();o.payment_status:='refunded';
 elsif p_action='edit' then
  if o.batch_id is not null or o.status not in ('new','ready') then raise exception 'แก้ที่อยู่ได้ก่อนส่งออกเท่านั้น'; end if;
  o.first_name:=p_data->>'first_name';o.last_name:=p_data->>'last_name';o.phone:=p_data->>'phone';o.address:=p_data->>'address';o.subdistrict:=p_data->>'subdistrict';o.district:=p_data->>'district';o.province:=p_data->>'province';o.postcode:=p_data->>'postcode';o.note:=coalesce(p_data->>'note','');
 else raise exception 'คำสั่งไม่รองรับ';end if;
 update book_orders set first_name=o.first_name,last_name=o.last_name,phone=o.phone,address=o.address,subdistrict=o.subdistrict,district=o.district,province=o.province,postcode=o.postcode,note=o.note,status=o.status,payment_status=o.payment_status,paid_at=o.paid_at,refunded_at=o.refunded_at,payment_note=o.payment_note,tracking=o.tracking,revision=revision+1,updated_at=now() where id=p_id returning * into o;
 insert into book_audit(actor,order_id,action,details) values(p_actor,p_id,p_action,jsonb_build_object('note',left(coalesce(p_data->>'note',''),500),'amount',case when o.method='cod' then o.amount else o.base_amount end));
 return to_jsonb(o)-'idempotency_hash'-'slip_hash';
end $$;

-- Appended to the finance migration. Private service-role RPC only.
create or replace function public.book_finance(p_actor uuid,p_from date default null,p_to date default null,p_basis text default 'ordered',p_view text default 'all',p_page int default 0,p_export boolean default false) returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb; lo timestamptz; hi timestamptz;
begin
 if not exists(select 1 from book_staff where user_id=p_actor and active and role in ('owner','finance')) then raise exception 'เฉพาะบัญชีและการเงิน';end if;
 if p_from>p_to or p_basis not in ('ordered','received','refunded') or p_view not in ('all','review','cod','refund') then raise exception 'ตรวจช่วงวันที่และประเภทรายงาน';end if;
 lo:=coalesce(p_from::timestamp at time zone 'Asia/Bangkok','-infinity');hi:=coalesce((p_to+1)::timestamp at time zone 'Asia/Bangkok','infinity');
 with src as (select o.*,case when method='cod' then amount else base_amount end cash_amount from book_orders o where not is_test),
 filtered as (select * from src where
  (case p_basis when 'ordered' then created_at when 'received' then paid_at else refunded_at end)>=lo and
  (case p_basis when 'ordered' then created_at when 'received' then paid_at else refunded_at end)<hi and
  case p_view when 'review' then status='new' and payment_status='review' when 'cod' then method='cod' and payment_status='cod_pending' and status not in ('cancelled','returned') when 'refund' then status in ('cancelled','returned') and payment_status in ('paid','cod_collected','refunded') else true end),
 page_rows as (select * from filtered order by created_at desc,id limit case when p_export then 10001 else 50 end offset case when p_export then 0 else greatest(0,p_page)*50 end)
 select jsonb_build_object('total',(select count(*) from filtered),'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',number,'created_at',created_at,'package',package,'amount',amount,'cash_amount',cash_amount,'method',method,'payment_status',payment_status,'status',status,'paid_at',paid_at,'refunded_at',refunded_at,'tracking',tracking,'payment_note',payment_note)) from page_rows),'[]'::jsonb),
 'summary',(select jsonb_build_object(
 'ordered',coalesce(sum(amount) filter(where created_at>=lo and created_at<hi and status not in ('cancelled','returned')),0),
 'transfer_received',coalesce(sum(cash_amount) filter(where method='transfer' and paid_at>=lo and paid_at<hi and payment_status in ('paid','refunded')),0),
 'cod_received',coalesce(sum(cash_amount) filter(where method='cod' and paid_at>=lo and paid_at<hi and payment_status in ('cod_collected','refunded')),0),
 'refunded',coalesce(sum(cash_amount) filter(where refunded_at>=lo and refunded_at<hi and payment_status='refunded'),0),
 'review',coalesce(sum(amount) filter(where status='new' and payment_status='review'),0),
 'pending_cod',coalesce(sum(amount) filter(where method='cod' and payment_status='cod_pending' and status not in ('cancelled','returned')),0)) from src)) into result;
 if p_export and (result->>'total')::int>10000 then raise exception 'รายงานเกิน 10,000 รายการ กรุณาเลือกช่วงวันที่แคบลง';end if;
 return result;
end $$;
revoke all on function public.book_finance(uuid,date,date,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.book_finance(uuid,date,date,text,text,integer,boolean) to service_role;
