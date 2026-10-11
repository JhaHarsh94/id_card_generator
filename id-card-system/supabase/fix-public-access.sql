-- =============================================================================
--  FIX 1 - let the public form work without a login, and make QR verification
--          readable by an anonymous visitor
-- =============================================================================
--  Run this in the Supabase SQL Editor (New query -> Run). Safe to re-run.
--
--  Two problems with the first schema, both of which break the app in public:
--
--  1. The card form at "/" is used by members of the public. It creates a member
--     with no session, but members_insert_admin only allows INSERT for
--     authenticated admins - so every submission from the public form was
--     rejected by RLS.
--
--  2. public_members was created with security_invoker = true, which makes the
--     view run as the CALLER. An anonymous visitor has no SELECT on members, so
--     scanning a QR on a phone returned nothing at all - every card would have
--     read NOT FOUND.
--
--  The fix deliberately keeps the anonymous write surface as small as possible:
--  a column-level INSERT grant means the browser can only ever set the fields
--  the form sets. It cannot write id, created_by, created_at, revocation_reason
--  or photo_path - so a caller cannot forge an admin attribution, backdate a
--  record, or mark itself revoked.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 2. public_members must ignore the caller's permissions.
--
-- The view's column list is already curated (no revocation_reason, no photo), so
-- reading it publicly exposes only what a QR scan is meant to show.
-- -----------------------------------------------------------------------------
drop view if exists public_members;
create view public_members as
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

grant select on public_members to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 1. Public form submissions.
--
-- Column-level grant: the browser may write these columns and nothing else.
-- -----------------------------------------------------------------------------
grant insert (
  member_id,
  full_name,
  designation,
  state,
  district,
  photo_url,
  valid_from,
  valid_until,
  status
) on members to anon;

drop policy if exists members_insert_public on members;
create policy members_insert_public on members
  for insert to anon
  with check (status = 'active');

-- Reading the members TABLE stays admin-only. That is what protects
-- revocation_reason and photo_url from being enumerated by guessing ids.


-- -----------------------------------------------------------------------------
-- Verify.
--
-- Each statement should succeed.
-- -----------------------------------------------------------------------------
-- 1. The public form can write:
--   insert into members (member_id, full_name, designation, state, district, photo_url, valid_from, valid_until, status)
--   values ('TEST0001', 'Test', 'Member', 'Uttar Pradesh', 'Baghpat', null, current_date, current_date + 365, 'active');
--
-- 2. An anonymous visitor can verify a card:
--   set local role anon;
--   select * from public_members where member_id = 'TEST0001';
--
-- 3. ...but cannot read the members table directly:
--   select revocation_reason from members;   -- must fail
--
-- 4. ...and cannot write a column it was not granted:
--   set local role anon;
--   insert into members (member_id, full_name, designation, state, created_by)
--   values ('TEST0002', 'X', 'Y', 'Z', null);   -- must fail: no grant


-- -----------------------------------------------------------------------------
-- Tidy up the row created by the check above.
-- -----------------------------------------------------------------------------
delete from members where member_id = 'TEST0001';