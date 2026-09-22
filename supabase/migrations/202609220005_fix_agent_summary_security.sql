-- Fix for Supabase Security Advisor Warning
-- View `public.agent_summary` is defined with the `SECURITY DEFINER` property.
-- Setting security_invoker = true so it runs with the privileges of the caller.

ALTER VIEW public.agent_summary SET (security_invoker = true);

-- Ensure only authenticated users can access the view
REVOKE ALL ON public.agent_summary FROM anon;
GRANT SELECT ON public.agent_summary TO authenticated;
