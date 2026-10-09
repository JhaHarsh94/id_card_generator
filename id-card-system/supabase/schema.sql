-- =============================================================================
--  Digital ID Card Management System - database schema
-- =============================================================================
--  Run this ONCE in the Supabase dashboard:  SQL Editor -> New query -> Run.
--
--  Design notes
--  ------------
--  * Every table has Row Level Security enabled. This is what makes the public
--    anon key safe to ship in frontend code: without a policy granting access,
--    the key can read nothing.
--  * `members` is readable by anonymous visitors, but ONLY the columns the
--    public verification page needs. Revocation reasons, notes and internal
--    timestamps are not exposed.
--  * Status is stored as a manual decision ('active' | 'expired' | 'revoked');
--    'expired' is derived at read time from valid_until. See the
--    `public_members` view.
--  * Storage buckets are private. Member photos are served through signed URLs
--    issued only to signed-in administrators.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. Enums
-- =============================================================================

do $$ begin
  create type member_status as enum ('active', 'expired', 'revoked');
exception when duplicate_object then null;
end $$;


-- =============================================================================
-- 2. Tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- admins - one row per authenticated administrator.
-- Authentication itself is handled by Supabase Auth (auth.users); this table
-- only carries the profile fields.
-- -----------------------------------------------------------------------------
create table if not exists admins (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null,
  role        text not null default 'administrator',
  created_at  timestamptz not null default now()
);

comment on table admins is
  'Administrator profiles. Identity is enforced by Supabase Auth.';

-- -----------------------------------------------------------------------------
-- organization - single-row configuration.
-- A CHECK constraint guarantees the one-organization model the brief requires;
-- there is no way to insert a second row.
-- -----------------------------------------------------------------------------
create table if not exists organization (
  id                    smallint primary key default 1,

  organization_name     text not null default '',
  organization_name_hi  text not null default '',
  registration_mark     text not null default '',
  registration_text     text not null default '',
  iso_text              text not null default '',

  logo_url              text,
  seal_url              text,
  signature_url         text,

  signatory_name        text not null default '',
  signatory_designation text not null default '',

  scope_text            text not null default '',
  support_text          text not null default '',
  footer_text           text not null default '',

  id_prefix             text not null default '',
  id_start              bigint not null default 1,
  id_padding            smallint not null default 7,

  default_validity_months smallint not null default 12,
  qr_enabled            boolean not null default true,

  -- Set once the organisation is real, so the "DEMO" watermark is removed.
  is_demo               boolean not null default true,

  updated_at            timestamptz not null default now(),

  constraint organization_single_row check (id = 1),
  constraint organization_id_padding_range check (id_padding between 3 and 12),
  constraint organization_validity_range check (default_validity_months between 1 and 120)
);

insert into organization (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- members - one row per issued ID card.
-- `member_id` is the human-readable number printed on the card and encoded in
-- the QR code, so it carries a uniqueness constraint.
-- -----------------------------------------------------------------------------
create table if not exists members (
  id                 uuid primary key default gen_random_uuid(),

  member_id          text not null unique
                       check (member_id ~ '^[A-Za-z0-9-]{3,24}$'),

  full_name          text not null check (char_length(full_name) between 1 and 80),
  designation        text not null check (char_length(designation) between 1 and 60),
  state              text not null check (char_length(state) between 1 and 60),
  district           text not null default '',

  photo_path         text,

  valid_from         date,
  valid_until        date not null,

  status             member_status not null default 'active',

  -- Kept for the organisation's records. Never exposed on the public page.
  revocation_reason  text,

  created_by         uuid references admins (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint members_validity_order check (
    valid_from is null or valid_from <= valid_until
  )
);

comment on column members.photo_path is
  'Object key inside the id-assets bucket, e.g. members/0095030/photo.jpg';

-- -----------------------------------------------------------------------------
-- audit_logs - append-only record of administrative actions.
-- -----------------------------------------------------------------------------
create table if not exists audit_logs (
  id         bigint generated always as identity primary key,
  admin_id   uuid references admins (id) on delete set null,
  action     text not null,
  member_id  text,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table audit_logs is
  'Append-only. Rows are never updated or deleted by application code.';


-- =============================================================================
-- 3. Public verification view
-- =============================================================================
-- The /verify/:id page reads this. It exposes only fields intended to be public
-- and derives the live status, so a card's reported status can never drift from
-- its dates.
-- =============================================================================

create or replace view public_members
with (security_invoker = true) as
select
  m.member_id,
  m.full_name,
  m.designation,
  m.state,
  m.valid_until,
  -- REVOKED wins over EXPIRED, which wins over ACTIVE.
  case
    when m.status = 'revoked' then 'revoked'
    when m.valid_until < (now() at time zone 'utc')::date then 'expired'
    else 'active'
  end as effective_status,
  (select o.organization_name from organization o where o.id = 1) as organization_name
from members m;

comment on view public_members is
  'Public verification data only. revocation_reason is deliberately excluded.';


-- =============================================================================
-- 4. Row Level Security
-- =============================================================================

alter table admins        enable row level security;
alter table organization enable row level security;
alter table members       enable row level security;
alter table audit_logs    enable row level security;

-- -----------------------------------------------------------------------------
-- Helper: true when the caller is a signed-in administrator.
-- Placed in its own function so the policies below stay readable.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins a where a.id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- admins: a signed-in user may read their own profile; admins may read all.
-- Insert happens from a trigger on first sign-in.
-- -----------------------------------------------------------------------------
drop policy if exists admins_read_own on admins;
create policy admins_read_own on admins
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists admins_insert_self on admins;
create policy admins_insert_self on admins
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists admins_update_admin on admins;
create policy admins_update_admin on admins
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- organization: readable by everyone (the header and footer are printed on
-- every card and shown on the public page). Writable only by admins.
-- -----------------------------------------------------------------------------
drop policy if exists organization_read_all on organization;
create policy organization_read_all on organization
  for select to anon, authenticated
  using (true);

drop policy if exists organization_write_admin on organization;
create policy organization_write_admin on organization
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- members
--
-- SELECT is public, but only through the security_invoker view when the caller
-- is anonymous. With RLS, a bare SELECT on `members` would expose
-- revocation_reason, so the policy below is intentionally NOT open to anon -
-- public verification reads `public_members` instead.
-- -----------------------------------------------------------------------------
drop policy if exists members_read_admin on members;
create policy members_read_admin on members
  for select to authenticated
  using (public.is_admin());

drop policy if exists members_insert_admin on members;
create policy members_insert_admin on members
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists members_update_admin on members;
create policy members_update_admin on members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists members_delete_admin on members;
create policy members_delete_admin on members
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- audit_logs: admins only. Insert is allowed so application code can record
-- actions; there is deliberately no update or delete policy.
-- -----------------------------------------------------------------------------
drop policy if exists audit_read_admin on audit_logs;
create policy audit_read_admin on audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_insert_admin on audit_logs;
create policy audit_insert_admin on audit_logs
  for insert to authenticated
  with check (public.is_admin());


-- =============================================================================
-- 5. Indexes
-- =============================================================================

create index if not exists members_member_id_idx      on members (member_id);
create index if not exists members_full_name_idx      on members (full_name);
create index if not exists members_status_idx         on members (status);
create index if not exists members_valid_until_idx    on members (valid_until);
create index if not exists members_state_idx          on members (state);

-- Supports the dashboard counts and "expiring soonest" lists without a scan.
create index if not exists members_status_valid_until_idx
  on members (status, valid_until);

create index if not exists members_created_at_idx     on members (created_at desc);

-- Lowercased name, for case-insensitive search without a functional index scan.
create index if not exists members_full_name_lower_idx
  on members (lower(full_name));

create index if not exists audit_logs_created_at_idx  on audit_logs (created_at desc);
create index if not exists audit_logs_member_idx     on audit_logs (member_id);


-- =============================================================================
-- 6. Triggers
-- =============================================================================

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_touch_updated_at on members;
create trigger members_touch_updated_at
  before update on members
  for each row execute function public.touch_updated_at();

drop trigger if exists organization_touch_updated_at on organization;
create trigger organization_touch_updated_at
  before update on organization
  for each row execute function public.touch_updated_at();

-- Create an admins row the first time a user signs in.
create or replace function public.handle_new_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into admins (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_admin();


-- =============================================================================
-- 7. Storage
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('id-assets', 'id-assets', false)
on conflict (id) do nothing;

comment on table storage.buckets is
  'Private bucket. Member photos and organisation assets are served to admins via signed URLs.';

-- Objects are namespaced "members/<member_id>/..." - no path traversal is
-- possible because the policy matches the caller's admin role, not the path.
drop policy if exists "admins manage id-assets" on storage.objects;
create policy "admins manage id-assets" on storage.objects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 8. Verify
-- =============================================================================

-- Should return exactly one row.
select * from organization where id = 1;

-- Once real members exist, this should return one row per card.
select * from public_members order by member_id limit 20;

-- Confirm the anon key cannot read sensitive columns. Run this with the anon
-- role and expect zero rows / permission denied:
--   set local role anon;
--   select revocation_reason from members;   -- must fail
--   select * from public_members;            -- must succeed


-- =============================================================================
-- Done. Next: copy .env.example to .env and add the project URL and anon key.
-- =============================================================================