-- Web analytics events for live visitors/hosts/guests and failed visit attempts

-- Table: web_events
CREATE TABLE IF NOT EXISTS public.web_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text NOT NULL,
  user_id uuid NULL,
  role_category text NOT NULL DEFAULT 'visitor',
  event_name text NOT NULL,
  path text NULL,
  referrer text NULL,
  user_agent text NULL,
  error_message text NULL,
  error_stack text NULL,
  error_source text NULL,
  CONSTRAINT web_events_role_category_check CHECK (role_category IN ('visitor', 'guest', 'host')),
  CONSTRAINT web_events_event_name_check CHECK (event_name IN ('page_view', 'heartbeat', 'client_error'))
);

CREATE INDEX IF NOT EXISTS web_events_created_at_idx ON public.web_events (created_at DESC);
CREATE INDEX IF NOT EXISTS web_events_event_name_created_at_idx ON public.web_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS web_events_role_category_created_at_idx ON public.web_events (role_category, created_at DESC);
CREATE INDEX IF NOT EXISTS web_events_session_id_created_at_idx ON public.web_events (session_id, created_at DESC);

ALTER TABLE public.web_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert events.
DROP POLICY IF EXISTS "Public can insert web events" ON public.web_events;
CREATE POLICY "Public can insert web events"
  ON public.web_events
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read events.
DROP POLICY IF EXISTS "Admins can view web events" ON public.web_events;
CREATE POLICY "Admins can view web events"
  ON public.web_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Helper: enforce admin access in SECURITY DEFINER RPCs
CREATE OR REPLACE FUNCTION public._require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$;

-- RPC: live counters for last N minutes
DROP FUNCTION IF EXISTS public.admin_web_analytics_live(integer);
CREATE OR REPLACE FUNCTION public.admin_web_analytics_live(window_minutes integer DEFAULT 15)
RETURNS TABLE (
  live_visitors integer,
  live_hosts integer,
  live_guests integer,
  failed_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_at timestamptz;
BEGIN
  PERFORM public._require_admin();

  start_at := now() - make_interval(mins => GREATEST(window_minutes, 1));

  RETURN QUERY
  WITH recent_sessions AS (
    SELECT DISTINCT ON (session_id)
      session_id,
      role_category,
      created_at
    FROM public.web_events
    WHERE created_at >= start_at
    ORDER BY session_id, created_at DESC
  ),
  error_sessions AS (
    SELECT COUNT(DISTINCT session_id)::int AS cnt
    FROM public.web_events
    WHERE created_at >= start_at
      AND event_name = 'client_error'
  )
  SELECT
    COALESCE(SUM(CASE WHEN recent_sessions.role_category = 'visitor' THEN 1 ELSE 0 END), 0)::int AS live_visitors,
    COALESCE(SUM(CASE WHEN recent_sessions.role_category = 'host' THEN 1 ELSE 0 END), 0)::int AS live_hosts,
    COALESCE(SUM(CASE WHEN recent_sessions.role_category = 'guest' THEN 1 ELSE 0 END), 0)::int AS live_guests,
    (SELECT cnt FROM error_sessions) AS failed_attempts
  FROM recent_sessions;
END;
$$;

-- RPC: timeseries for page views + failed attempts
DROP FUNCTION IF EXISTS public.admin_web_analytics_series(text);
CREATE OR REPLACE FUNCTION public.admin_web_analytics_series(p_range text DEFAULT '24h')
RETURNS TABLE (
  bucket timestamptz,
  page_views integer,
  failed_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_at timestamptz;
  bucket_interval interval;
  normalized text;
BEGIN
  PERFORM public._require_admin();

  normalized := lower(trim(coalesce(p_range, '24h')));

  IF normalized = '1h' THEN
    start_at := now() - interval '1 hour';
    bucket_interval := interval '5 minutes';
  ELSIF normalized = '7d' THEN
    start_at := now() - interval '7 days';
    bucket_interval := interval '1 day';
  ELSIF normalized = '30d' THEN
    start_at := now() - interval '30 days';
    bucket_interval := interval '1 day';
  ELSE
    -- default 24h
    start_at := now() - interval '24 hours';
    bucket_interval := interval '1 hour';
  END IF;

  RETURN QUERY
  WITH bins AS (
    SELECT generate_series(
      date_bin(bucket_interval, start_at, start_at),
      date_bin(bucket_interval, now(), start_at),
      bucket_interval
    ) AS bucket
  ),
  agg AS (
    SELECT
      date_bin(bucket_interval, created_at, start_at) AS bucket,
      COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
      COUNT(*) FILTER (WHERE event_name = 'client_error')::int AS failed_attempts
    FROM public.web_events
    WHERE created_at >= start_at
    GROUP BY 1
  )
  SELECT
    bins.bucket,
    COALESCE(agg.page_views, 0)::int AS page_views,
    COALESCE(agg.failed_attempts, 0)::int AS failed_attempts
  FROM bins
  LEFT JOIN agg USING (bucket)
  ORDER BY bins.bucket ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_web_analytics_live(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_web_analytics_series(text) TO authenticated;
