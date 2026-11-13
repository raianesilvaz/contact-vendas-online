-- CONTACT SMS: schema proposal, NOT applied to production.
-- Keep marketing records private; backend must authorize administrator before access.
create schema if not exists contact_sms_private;

create table if not exists contact_sms_private.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 90),
  message_text text not null check (length(message_text) between 1 and 600),
  status text not null default 'draft' check (status in ('draft','ready','paused','completed','cancelled')),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists contact_sms_private.recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references contact_sms_private.campaigns(id) on delete restrict,
  phone_e164 text not null check (phone_e164 ~ '^55[1-9][0-9]{9,10}$'),
  contact_source text not null,
  contact_id text not null,
  consent_recorded_at timestamptz not null,
  opted_out_at timestamptz,
  status text not null default 'pending' check (status in ('pending','reserved','sending','sent','failed','unknown','skipped')),
  batch_number integer not null check (batch_number >= 1),
  reserved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (campaign_id,phone_e164)
);
create index if not exists sms_recipients_phone_sent_idx
  on contact_sms_private.recipients(phone_e164,sent_at desc)
  where status = 'sent';
create index if not exists sms_recipients_campaign_batch_idx
  on contact_sms_private.recipients(campaign_id,batch_number,status);

create table if not exists contact_sms_private.attempts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references contact_sms_private.recipients(id) on delete restrict,
  idempotency_key uuid not null unique,
  status text not null check (status in ('reserved','sending','sent','failed','unknown')),
  error_code text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists contact_sms_private.suppression (
  phone_e164 text primary key check (phone_e164 ~ '^55[1-9][0-9]{9,10}$'),
  reason text not null,
  created_at timestamptz not null default now()
);

-- No browser-facing privileges. The server must verify admin identity,
-- consent, suppression, 7-day cooldown and atomic reservation in one transaction.
revoke all on schema contact_sms_private from public, anon, authenticated;
revoke all on all tables in schema contact_sms_private from public, anon, authenticated;
alter table contact_sms_private.campaigns enable row level security;
alter table contact_sms_private.recipients enable row level security;
alter table contact_sms_private.attempts enable row level security;
alter table contact_sms_private.suppression enable row level security;
-- No policies intentionally: fail closed until backend authorization is implemented.
