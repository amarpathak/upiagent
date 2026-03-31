-- upiagent SaaS — Initial Database Schema
-- Run this in your Supabase SQL editor

-- Merchants table (extends Supabase Auth users)
create table merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  upi_id text not null,
  name text not null,

  -- Gmail credentials (encrypted at rest via Supabase)
  gmail_client_id text,
  gmail_client_secret text,
  gmail_refresh_token text,

  -- LLM config
  llm_provider text default 'gemini',
  llm_api_key text,

  -- Verification sources
  enabled_sources text[] default '{gmail}',

  -- Webhooks
  webhook_url text,
  webhook_secret text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- API keys
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  name text default 'Default',
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Payments
create table payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  transaction_id text unique not null,

  amount numeric(12,2) not null,
  amount_with_paisa numeric(12,2),
  note text,
  intent_url text,
  qr_data_url text,

  status text default 'pending',
  expires_at timestamptz,

  upi_reference_id text,
  sender_name text,
  sender_upi_id text,
  bank_name text,

  verification_source text,
  overall_confidence numeric(3,2),
  screenshot_url text,

  created_at timestamptz default now(),
  verified_at timestamptz
);

-- Verification evidence — each source's attempt is recorded
create table verification_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete cascade,

  source text not null,
  status text not null,
  confidence numeric(3,2),

  extracted_amount numeric(12,2),
  extracted_upi_ref text,
  extracted_sender text,
  extracted_bank text,
  extracted_timestamp timestamptz,

  raw_data jsonb,
  layer_results jsonb,

  created_at timestamptz default now()
);

-- Webhook deliveries
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete cascade,

  url text not null,
  method text default 'POST',
  request_body jsonb,
  status_code int,
  response_body text,

  attempt int default 1,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

-- Row Level Security
alter table merchants enable row level security;
alter table api_keys enable row level security;
alter table payments enable row level security;
alter table verification_evidence enable row level security;
alter table webhook_deliveries enable row level security;

-- Policies: merchants see only their own data
create policy "merchants_select" on merchants for select using (user_id = auth.uid());
create policy "merchants_insert" on merchants for insert with check (user_id = auth.uid());
create policy "merchants_update" on merchants for update using (user_id = auth.uid());

create policy "api_keys_all" on api_keys for all using (
  merchant_id in (select id from merchants where user_id = auth.uid())
);

create policy "payments_all" on payments for all using (
  merchant_id in (select id from merchants where user_id = auth.uid())
);

create policy "evidence_all" on verification_evidence for all using (
  payment_id in (
    select p.id from payments p
    join merchants m on p.merchant_id = m.id
    where m.user_id = auth.uid()
  )
);

create policy "webhooks_all" on webhook_deliveries for all using (
  payment_id in (
    select p.id from payments p
    join merchants m on p.merchant_id = m.id
    where m.user_id = auth.uid()
  )
);

-- Indexes for performance
create index idx_payments_merchant on payments(merchant_id);
create index idx_payments_status on payments(status);
create index idx_payments_txn_id on payments(transaction_id);
create index idx_payments_created on payments(created_at desc);
create index idx_evidence_payment on verification_evidence(payment_id);
create index idx_webhook_payment on webhook_deliveries(payment_id);
create index idx_api_keys_hash on api_keys(key_hash);
