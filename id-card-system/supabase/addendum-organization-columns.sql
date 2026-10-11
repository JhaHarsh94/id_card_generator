-- =============================================================================
--  ADDENDUM - organisation columns the card needs
-- =============================================================================
--  Run this AFTER schema.sql, in the Supabase SQL Editor (New query -> Run).
--
--  Why a separate script: the first version of schema.sql created the
--  organization table without three columns the card template reads. The table
--  is already live by the time this is discovered, and `create table if not
--  exists` will not add columns to an existing table - so they are added here
--  with `add column if not exists`, which is safe to re-run any number of
--  times.
--
--  The three:
--
--    registration_value  the registration number itself. `registration_text`
--                        holds only the LABEL ("पंजीकरण सं०"); without this the
--                        card's top-left corner has a caption and no value.
--
--    trust_name_en       the English trust name, printed as the single largest
--                        element in the header.
--
--    authority_text      "Government of Uttar Pradesh", printed in the header
--                        between the registration and ID numbers.
--
--  schema.sql has been corrected too, so a fresh project gets all of them in
--  one run. This script is for projects that already ran the old version.
-- =============================================================================

alter table organization
  add column if not exists registration_value text not null default '',
  add column if not exists trust_name_en      text not null default '',
  add column if not exists authority_text     text not null default '';

-- Seed the three new columns with the organisation's real values, so the card
-- renders correctly the moment the app is switched over to Supabase.
update organization set
  registration_value = coalesce(nullif(registration_value, ''), '29/2024'),
  trust_name_en      = coalesce(nullif(trust_name_en, ''), 'PUNAM KABIRA SARV DHARAM SAHAYATA TRUST'),
  authority_text     = coalesce(nullif(authority_text, ''), 'Government of Uttar Pradesh')
where id = 1;

-- Confirm. This should list three more columns than before.
select column_name, column_default
from information_schema.columns
where table_name = 'organization'
order by ordinal_position;

-- Confirm the seeded row. trust_name_en and authority_text must be populated.
select id, registration_value, trust_name_en, authority_text
from organization
where id = 1;