-- Execute in a controlled database session. All fixtures are rolled back.
-- No SMS provider calls occur.
do $test$
declare v_id uuid; v_first integer; v_second integer; v_third integer;
begin
  begin
    insert into contact_sms_private.campaigns(title,message_text,status,created_by)
    values ('SMS TESTE TEMPORÁRIO','Mensagem de teste, não enviar','ready','00000000-0000-0000-0000-000000000001')
    returning id into v_id;
    insert into contact_sms_private.recipients(campaign_id,phone_e164,contact_source,contact_id,consent_recorded_at,batch_number)
    select v_id, '5518'||(990000000+g)::text,'test',g::text,now(),1
    from generate_series(1,55) g;
    select count(*) into v_first from contact_sms_private.reserve_next_batch(v_id,50);
    select count(*) into v_second from contact_sms_private.reserve_next_batch(v_id,50);
    select count(*) into v_third from contact_sms_private.reserve_next_batch(v_id,50);
    if (v_first,v_second,v_third) is distinct from (50,5,0) then
      raise exception 'Unexpected batch counts: %, %, %',v_first,v_second,v_third;
    end if;
    raise exception 'SMS_TEST_ROLLBACK_OK_50_5_0';
  exception when others then
    if sqlerrm <> 'SMS_TEST_ROLLBACK_OK_50_5_0' then raise; end if;
    raise notice 'SMS batch test passed: 50, 5, 0; fixtures rolled back';
  end;
end $test$;
