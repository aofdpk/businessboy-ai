-- All fixtures and mutations remain invisible outside this transaction and are rolled back.
begin;
do $$
declare actor uuid; owner_id uuid; ids uuid[]:='{}'; oid uuid; bid uuid:=gen_random_uuid(); result jsonb; o book_orders; i integer; failed boolean;
begin
 select user_id into actor from book_staff where username='natlogis' and active and role='fulfillment';
 select user_id into owner_id from book_staff where role='owner' and active limit 1;
 if actor is null or owner_id is null then raise exception 'Missing accounts';end if;
 for i in 1..4 loop
  oid:=gen_random_uuid();ids:=array_append(ids,oid);
  insert into book_orders(id,number,idempotency_hash,first_name,last_name,phone,address,subdistrict,district,province,postcode,package,amount,method,payment_status,status,is_test)
  overriding system value values(oid,-9000-i,encode(extensions.digest(oid::text,'sha256'),'hex'),'QA','shipping','0812345678','99 QA','QA','QA','QA','10100',case when i>2 then 'bundle' else 'book' end,case when i>2 then 490 else 345 end,case when i%2=0 then 'cod' else 'transfer' end,case when i%2=0 then 'cod_pending' else 'paid' end,'ready',false);
 end loop;
 -- A transfer cannot be exported before money approval.
 update book_orders set status='new',payment_status='review',slip_path='QA_ONLY' where id=ids[1];
 failed:=false;begin perform book_export(gen_random_uuid(),array[ids[1]],actor);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Unpaid export allowed';end if;
 select * into o from book_orders where id=ids[1];
 failed:=false;begin perform book_change(o.id,o.revision,actor,'paid');exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Logistics approved money';end if;
 perform book_change(o.id,o.revision,owner_id,'paid');
 -- COD confirmation belongs to logistics.
 update book_orders set status='new' where id=ids[2];
 select * into o from book_orders where id=ids[2];
 perform book_change(o.id,o.revision,actor,'ready');
 result:=book_export(bid,ids,actor);
 if jsonb_array_length(result->'orders')<>4 then raise exception 'Wrong export count';end if;
 if (select sum((r->>'amount')::int) from jsonb_array_elements(result->'orders') r where r->>'method'='cod')<>835 then raise exception 'Wrong COD amount';end if;
 if (select count(*) from jsonb_array_elements(result->'orders') r where r->>'package'='bundle')<>2 then raise exception 'Lost product package';end if;
 if book_export(bid,ids,actor)<>result then raise exception 'Retry changed snapshot';end if;
 failed:=false;begin perform book_export(gen_random_uuid(),ids,actor);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Duplicate export allowed';end if;
 if exists(select 1 from book_orders where id=any(ids) and status<>'ready') then raise exception 'Export marked shipped';end if;
 if not exists(select 1 from jsonb_array_elements(book_crm(actor,0,'exported','QA',0)->'orders') r where r->>'id'=ids[1]::text) then raise exception 'Exported queue missing';end if;
 select * into o from book_orders where id=ids[1];
 perform book_change(o.id,o.revision,actor,'shipped','{"tracking":"QA-NOT-SHIPPED-123"}');
 if not exists(select 1 from book_orders where id=o.id and status='shipped' and tracking='QA-NOT-SHIPPED-123') then raise exception 'Tracking failed';end if;
 failed:=false;begin perform book_sales_action(ids[2],0,owner_id,'claim');exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Paused sales RPC allowed';end if;
end $$;
select 'PASS: payment gate, logistics permissions, both packages/methods, COD 835, export retry, duplicate prevention, exported queue, shipment, paused sales' as result;
rollback;
