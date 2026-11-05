grant delete on public.fpd_records, public.fpd_imports to authenticated;
-- Only the isolated FPD workspace can be replaced. CONTACT source tables remain read-only.
create policy fpd_records_replace_delete on public.fpd_records for delete to authenticated using ((select private.current_user_role()) = 'admin'::public.user_role);
create policy fpd_imports_replace_delete on public.fpd_imports for delete to authenticated using ((select private.current_user_role()) = 'admin'::public.user_role);
CREATE OR REPLACE FUNCTION public.import_fpd_records(p_file_name text, p_records jsonb, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_count integer; v_new integer; v_summary jsonb;
begin
 if auth.uid() is null or private.current_user_role() is distinct from 'admin'::public.user_role then
  raise exception 'Somente administradores podem importar FPD.' using errcode='42501';
 end if;
 if p_request_id is null or char_length(btrim(p_file_name)) not between 1 and 255 or jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Arquivo inválido.'; end if;
 v_count:=jsonb_array_length(p_records);
 if v_count not between 1 and 10000 then raise exception 'Importe de 1 a 10.000 linhas por arquivo.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('contact-fpd-import',0));
 select summary into v_summary from public.fpd_imports where id=p_request_id;
 if found then return v_summary; end if;
 if exists(select 1 from jsonb_to_recordset(p_records) as r(contract_number text,invoice_no integer)
   where nullif(btrim(r.contract_number),'') is null or char_length(r.contract_number)>100 or r.invoice_no is null or r.invoice_no not between 1 and 4)
 then raise exception 'Contrato ou número da fatura inválido.'; end if;
 if exists(select 1 from jsonb_to_recordset(p_records) as r(contract_number text,invoice_no integer)
   group by upper(btrim(r.contract_number)),r.invoice_no having count(*)>1)
 then raise exception 'O arquivo contém contrato e fatura duplicados. Revise antes de importar.'; end if;
 -- Replacement is atomic; a validation/lookup failure rolls back both deletes.
 delete from public.fpd_records;
 delete from public.fpd_imports;
 v_new := v_count;
 insert into public.fpd_imports(id,file_name,imported_by) values(p_request_id,btrim(p_file_name),auth.uid());
 with input as (
  select upper(btrim(r.contract_number)) as key,r.* from jsonb_to_recordset(p_records) as r(
   contract_number text,invoice_no integer,collection_type text,installation_date_text text,due_date_text text,
   payment_date_text text,collection_situation text,installation_month text,days_open integer,follow_up text,validation_notes text[])
 ), matches as (
  select upper(btrim(s.contract_number)) as key,count(*) as n,(array_agg(s.id))[1] as sale_id,
   (array_agg(s.customer_name))[1] as customer_name,(array_agg(p.full_name))[1] as seller_name
  from public.sales s left join public.profiles p on p.id=s.seller_id
  where upper(btrim(s.contract_number)) in (select key from input)
  group by upper(btrim(s.contract_number))
 )
 insert into public.fpd_records(contract_number,invoice_no,collection_type,installation_date_text,due_date_text,payment_date_text,
 collection_situation,installation_month,days_open,follow_up,sale_id,customer_name,seller_name,match_status,validation_notes,last_import_id)
 select i.key,i.invoice_no,coalesce(i.collection_type,''),coalesce(i.installation_date_text,''),coalesce(i.due_date_text,''),coalesce(i.payment_date_text,''),
 coalesce(i.collection_situation,''),coalesce(i.installation_month,''),i.days_open,coalesce(i.follow_up,''),
 case when m.n=1 then m.sale_id end,case when m.n=1 then m.customer_name end,case when m.n=1 then m.seller_name end,
 case when m.n=1 then 'matched' when m.n>1 then 'ambiguous' else 'unmatched' end,coalesce(i.validation_notes,'{}'),p_request_id
 from input i left join matches m on m.key=i.key;
 select jsonb_build_object('total',v_count,'inserted',v_new,'updated',v_count-v_new,
 'matched',count(*) filter(where match_status='matched'),'unmatched',count(*) filter(where match_status='unmatched'),
 'ambiguous',count(*) filter(where match_status='ambiguous'),'warnings',count(*) filter(where cardinality(validation_notes)>0))
 into v_summary from public.fpd_records where last_import_id=p_request_id;
 update public.fpd_imports set summary=v_summary where id=p_request_id;
 return v_summary;
end;
$function$
