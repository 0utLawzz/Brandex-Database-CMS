-- =============================================================================
-- MIGRATION: 202609200002_agents_fees.sql
-- PURPOSE : Agents master table + per-case fee tracking (Option A: per-case)
-- RUN ON  : Supabase → SQL Editor → paste → Run
-- Run AFTER 202609200001_match_engine_publication.sql
-- SAFE    : Uses IF NOT EXISTS / CREATE OR REPLACE — safe to re-run
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: AGENTS TABLE
-- Har agent ka master record — naam, city, contact
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  city            TEXT,
  phone           TEXT,
  email           TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast search by name
CREATE INDEX IF NOT EXISTS agents_name_idx
  ON public.agents (name);

-- Fast filter by city
CREATE INDEX IF NOT EXISTS agents_city_idx
  ON public.agents (city) WHERE city IS NOT NULL;

-- Fast filter active only
CREATE INDEX IF NOT EXISTS agents_active_idx
  ON public.agents (is_active) WHERE is_active = TRUE;

-- =============================================================================
-- PART 2: AGENT_FEES TABLE
-- Har trademark case ke liye per-agent fee entry
-- Ek case → ek agent → ek ya zyada fee entries (multiple hearings etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_fees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trademark_id    TEXT NOT NULL REFERENCES public.trademarks(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  description     TEXT NOT NULL DEFAULT '',
  amount_billed   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_billed >= 0),
  amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  fee_date        DATE NOT NULL DEFAULT current_date,
  paid            BOOLEAN NOT NULL DEFAULT FALSE,
  paid_date       DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by trademark case
CREATE INDEX IF NOT EXISTS agent_fees_trademark_idx
  ON public.agent_fees (trademark_id);

-- Fast lookup by agent
CREATE INDEX IF NOT EXISTS agent_fees_agent_idx
  ON public.agent_fees (agent_id);

-- Fast lookup of unpaid entries (for dashboard alerts)
CREATE INDEX IF NOT EXISTS agent_fees_unpaid_idx
  ON public.agent_fees (paid, fee_date) WHERE paid = FALSE;

-- =============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- Supabase ke policy — kaun kya kar sakta hai
-- =============================================================================

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_fees ENABLE ROW LEVEL SECURITY;

-- Sabhi logged-in staff agents dekh saktay hain
CREATE POLICY "staff_read_agents" ON public.agents
  FOR SELECT TO authenticated USING (true);

-- Sirf editor/admin agents add/edit kar saktay hain
CREATE POLICY "editors_manage_agents" ON public.agents
  FOR ALL TO authenticated
  USING (public.current_brandex_role() IN ('editor', 'admin'))
  WITH CHECK (public.current_brandex_role() IN ('editor', 'admin'));

-- Sabhi logged-in staff fees dekh saktay hain
CREATE POLICY "staff_read_fees" ON public.agent_fees
  FOR SELECT TO authenticated USING (true);

-- Sirf editor/admin fees add/edit kar saktay hain
CREATE POLICY "editors_manage_fees" ON public.agent_fees
  FOR ALL TO authenticated
  USING (public.current_brandex_role() IN ('editor', 'admin'))
  WITH CHECK (public.current_brandex_role() IN ('editor', 'admin'));

-- =============================================================================
-- PART 4: AGENT SUMMARY VIEW
-- Har agent ke liye: total fees billed, paid, balance, unpaid count
-- Frontend mein AgentsPage pe direct use hoga
-- =============================================================================

CREATE OR REPLACE VIEW public.agent_summary AS
SELECT
  a.id,
  a.name,
  a.city,
  a.phone,
  a.email,
  a.is_active,
  -- Kitne cases mein fees hain
  COUNT(DISTINCT af.trademark_id) AS cases_with_fees,
  -- Total amount
  COALESCE(SUM(af.amount_billed), 0) AS total_billed,
  COALESCE(SUM(af.amount_paid), 0) AS total_paid,
  COALESCE(SUM(af.amount_billed - af.amount_paid), 0) AS balance_due,
  -- Kitni entries abhi unpaid hain
  COUNT(af.id) FILTER (WHERE af.paid = FALSE AND af.amount_billed > af.amount_paid) AS unpaid_entries
FROM public.agents a
LEFT JOIN public.agent_fees af ON af.agent_id = a.id
GROUP BY a.id, a.name, a.city, a.phone, a.email, a.is_active;

-- Give authenticated users access to view
GRANT SELECT ON public.agent_summary TO authenticated;

-- =============================================================================
-- PART 5: AUTO-UPDATE UPDATED_AT ON AGENTS AND AGENT_FEES
-- Same pattern as trademarks table
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_agents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agents_set_updated_at ON public.agents;
CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_agents_updated_at();

DROP TRIGGER IF EXISTS agent_fees_set_updated_at ON public.agent_fees;
CREATE TRIGGER agent_fees_set_updated_at
  BEFORE UPDATE ON public.agent_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_agents_updated_at();

COMMIT;

-- =============================================================================
-- HOW TO VERIFY after running:
--
-- 1. Tables exist?
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('agents','agent_fees') AND table_schema='public';
--
-- 2. View works?
-- SELECT * FROM public.agent_summary;
--
-- 3. Insert a test agent (as admin):
-- INSERT INTO public.agents (name, city, phone)
-- VALUES ('Test Agent', 'Islamabad', '0300-0000000');
--
-- 4. View test agent:
-- SELECT * FROM public.agent_summary;
--
-- 5. Delete test agent:
-- DELETE FROM public.agents WHERE name = 'Test Agent';
-- =============================================================================
