-- Ensure PostgREST roles can insert analytics events
-- NOTE: RLS still applies; this only grants table privileges.

GRANT INSERT ON TABLE public.web_events TO anon;
GRANT INSERT ON TABLE public.web_events TO authenticated;

-- Allow authenticated users to select; RLS policy restricts to admins.
GRANT SELECT ON TABLE public.web_events TO authenticated;
