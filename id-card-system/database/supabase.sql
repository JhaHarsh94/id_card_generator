-- The application accesses these tables through its server-side PostgreSQL
-- connection. Supabase browser roles must not access credentials or member data.
BEGIN;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_users, public.sessions, public.organization, public.members FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_users, public.sessions, public.organization, public.members FROM anon, authenticated;
COMMIT;
