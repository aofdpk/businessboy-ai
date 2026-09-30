create or replace function public.book_addon_action(p_id uuid,p_revision integer,p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
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
  if a.product='prompt_upgrade' and (a.method='cod' or o.status not in ('cancelled','returned')) then raise exception 'คืนส่วนเพิ่ม Prompt แบบโอนได้หลังยกเลิกหรือรับคืนหนังสือ ส่วน COD ให้คืนผ่านออเดอร์หลัก';end if;
  if length(trim(coalesce(p_data->>'note','')))<3 then raise exception 'กรอกเหตุผลคืนเงินและผลการยกเลิกสิทธิ์';end if;
  a.payment_status:='refunded';a.delivery_note:=left(p_data->>'note',1000);
 else raise exception 'ไม่พบคำสั่ง';end if;
 update book_addons set payment_status=a.payment_status,delivery_status=a.delivery_status,line_name=a.line_name,activation_code=a.activation_code,delivery_note=a.delivery_note,paid_at=a.paid_at,delivered_at=a.delivered_at,revision=revision+1 where id=p_id returning * into a;
 insert into book_audit(actor,order_id,action,details) values(p_actor,o.id,'addon_'||p_action,jsonb_build_object('addon_id',a.id,'product',a.product,'amount',a.amount,'delivery_status',a.delivery_status));
 return to_jsonb(a)-'slip_hash'-'slip_path';
end $$;

