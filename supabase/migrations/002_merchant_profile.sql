-- Add merchant profile fields for payment page trust signals
alter table merchants add column if not exists display_name text;
alter table merchants add column if not exists upi_account_holder text;
alter table merchants add column if not exists contact_email text;
alter table merchants add column if not exists contact_phone text;
alter table merchants add column if not exists website_url text;
alter table merchants add column if not exists description text;
alter table merchants add column if not exists logo_url text;

-- display_name: shown on payment page ("birthstarai", "Cool Shop")
-- upi_account_holder: the real name on the bank account ("AMAR KUMAR PATHAK")
-- This lets customers see: "You're paying birthstarai (AMAR KUMAR PATHAK)"
