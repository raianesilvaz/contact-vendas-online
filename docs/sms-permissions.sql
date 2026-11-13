-- Evidence registry: no contact is opted in automatically.
create table if not exists contact_sms_private.permissions (
  phone_e164 text primary key check (phone_e164 ~ '^55[1-9][0-9]{9,10}$'),
  allowed boolean not null default false,
  evidence_source text not null check (length(trim(evidence_source)) between 3 and 300),
  evidence_recorded_at timestamptz not null,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table contact_sms_private.permissions enable row level security;
revoke all on contact_sms_private.permissions from public,anon,authenticated;
create index if not exists sms_recipients_pending_idx on contact_sms_private.recipients(campaign_id,batch_number,created_at) where status='pending';
