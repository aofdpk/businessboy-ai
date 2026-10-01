begin;
do $$
declare actor uuid; logis uuid; ids uuid[]:='{}'; oid uuid; i int; o book_orders; failed boolean; baseline jsonb; result jsonb; d date:=(now() at time zone 'Asia/Bangkok')::date;
begin
 select user_id into actor from book_staff where username='financialacc' and active and role='finance';
 select user_id into logis from book_staff where username='natlogis';
 if actor is null then raise exception 'Finance account missing';end if;
 baseline:=book_finance(actor,d,d)->'summary';
 for i in 1..5 loop
  oid:=gen_random_uuid();ids:=array_append(ids,oid);
  insert into book_orders(id,number,idempotency_hash,first_name,last_name,phone,address,subdistrict,district,province,postcode,package,amount,method,payment_status,status,is_test,created_at,paid_at,slip_path)
  overriding system value values(oid,-9100-i,encode(extensions.digest(oid::text,'sha256'),'hex'),'QA','finance','0812345678','99 QA','QA','QA','QA','10100',case when i in (2,4) then 'bundle' else 'book' end,case when i in (2,4) then 490 else 345 end,case when i in (2,4) then 'cod' else 'transfer' end,case when i in (2,4) then 'cod_pending' when i=5 then 'review' else 'paid' end,case when i in (2,4) then 'delivered' when i=3 then 'cancelled' when i=5 then 'new' else 'ready' end,false,case when i=1 then now()-interval '40 days' else now() end,case when i=1 then now() when i=3 then now()-interval '40 days' else null end,case when i=5 then 'QA_ONLY' else null end);
 end loop;
 select * into o from book_orders where id=ids[3];
 perform book_change(o.id,o.revision,actor,'refunded','{"note":"QA refund only"}');
 select * into o from book_orders where id=ids[4];
 perform book_change(o.id,o.revision,actor,'cod_collected');
 failed:=false;begin perform book_change(o.id,o.revision,actor,'cod_collected');exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Duplicate COD receipt accepted';end if;
 select * into o from book_orders where id=ids[5];
 failed:=false;begin perform book_change(o.id,o.revision,actor,'reject_slip');exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Rejected slip without reason';end if;
 perform book_change(o.id,o.revision,actor,'reject_slip','{"note":"QA wrong amount"}');
 if not exists(select 1 from book_orders where id=o.id and payment_status='awaiting_slip' and payment_note='QA wrong amount') then raise exception 'Missing rejection reason';end if;
 update book_orders set payment_status='review' where id=ids[5];
 select * into o from book_orders where id=ids[5];
 perform book_change(o.id,o.revision,actor,'paid');
 if not exists(select 1 from book_orders where id=o.id and status='ready' and payment_status='paid') then raise exception 'Paid order not ready';end if;
 result:=book_finance(actor,d,d);
 if (result->'summary'->>'transfer_received')::int-(baseline->>'transfer_received')::int<>690 then raise exception 'Incorrect transfer receipts';end if;
 if (result->'summary'->>'cod_received')::int-(baseline->>'cod_received')::int<>490 then raise exception 'Incorrect COD receipts';end if;
 if (result->'summary'->>'refunded')::int-(baseline->>'refunded')::int<>345 then raise exception 'Incorrect refunds';end if;
 if (result->'summary'->>'pending_cod')::int-(baseline->>'pending_cod')::int<>490 then raise exception 'Pending COD counted as cash';end if;
 if (result->'summary'->>'ordered')::int-(baseline->>'ordered')::int<>1325 then raise exception 'Incorrect order date or cancelled sales';end if;
 if not exists(select 1 from jsonb_array_elements(book_finance(actor,d,d,'received')->'orders') r where r->>'id'=ids[1]::text) then raise exception 'Older order paid today missing';end if;
 if not exists(select 1 from jsonb_array_elements(book_finance(actor,d,d,'refunded')->'orders') r where r->>'id'=ids[3]::text) then raise exception 'Refund date missing';end if;
 if not exists(select 1 from book_orders where id=ids[3] and paid_at<now()-interval '30 days' and refunded_at>=d::timestamp at time zone 'Asia/Bangkok') then raise exception 'Refund erased original receipt';end if;
 failed:=false;begin perform book_finance(logis);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Logistics allowed finance report';end if;
 select * into o from book_orders where id=ids[5];
 failed:=false;begin perform book_change(o.id,o.revision,actor,'edit','{}');exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Finance edited shipping data';end if;
 failed:=false;begin perform book_export(gen_random_uuid(),array[ids[5]],actor);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Finance exported shipping';end if;
end $$;
select 'PASS: financial role, payment approval, reject reason, COD receipt, refund dates, separate order/receipt dates, no double receipt and no shipping writes' as result;
rollback;
