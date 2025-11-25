-- SQL Function to get current session data
-- Run this in your Supabase SQL Editor to create the function

CREATE OR REPLACE FUNCTION get_current_session(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id UUID,
  clock_in TIMESTAMPTZ,
  session_end TIMESTAMPTZ,
  duration_minutes NUMERIC,
  has_clocked_out BOOLEAN,
  clock_in_lat NUMERIC,
  clock_in_lng NUMERIC,
  clock_in_address TEXT,
  clock_out_lat NUMERIC,
  clock_out_lng NUMERIC,
  clock_out_address TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.user_id,
    a.time_in AS clock_in,
    COALESCE(a.time_out, p.last_activity, NOW()) AS session_end,
    EXTRACT(EPOCH FROM (COALESCE(a.time_out, p.last_activity, NOW()) - a.time_in))/60 AS duration_minutes,
    (a.time_out IS NOT NULL) AS has_clocked_out,
    a.clock_in_lat,
    a.clock_in_lng,
    a.clock_in_address,
    a.clock_out_lat,
    a.clock_out_lng,
    a.clock_out_address
  FROM attendance a
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE a.user_id = p_user_id
    AND a.date = p_date
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_session(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_session(UUID) TO authenticated;
