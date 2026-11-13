-- Rollback-only integration test for cooldown and suppression.
do $test$
declare a uuid; b uuid; reserved_count integer;
begin
  begin
    insert into contact_sms_private.campaigns(title,message_text,status,created_by)
    values ('SMS TESTE A','Somente teste','ready','00000000-0000-0000-0000-000000000001') returning id into a;
    insert into contact_sms_private.campaigns(title,message_text,status,created_by)
    values ('SMS TESTE B','Somente teste','ready','00000000-0000-0000-0000-000000000001') returning id into b;
    insert into contact_sms_private.recipients(campaign_id,phone_e164,contact_source,contact_id,consent_recorded_at,batch_number,status,sent_at)
    values(a,'5518991111111','test','1',now(),1,'sent',now());
    insert into contact_sms_private.recipients(campaign_id,phone_e164,contact_source,contact_id,consent_recorded_at,batch_number)
    values(b,'5518991111111','test','2',now(),1),
          (b,'5518992222222','test','3',now(),1),
          (b,'5518993333333','test','4',now(),1);
    insert into contact_sms_private.suppression(phone_e164,reason) values('5518992222222','test');
    select count(*) into reserved_count from contact_sms_private.reserve_next_batch(b,50);
    if reserved_count<>1 then raise exception 'Expected 1 eligible, got %',reserved_count; end if;
    raise exception 'SMS_TEST_ROLLBACK_OK';
  exception when others then
    if sqlerrm<>'SMS_TEST_ROLLBACK_OK' then raise; end if;
    raise notice 'Cooldown and suppression tests passed; fixtures rolled back';
  end;
end $test$;
