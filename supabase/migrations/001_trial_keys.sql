-- Trial Keys Table for Command Nexus 3-Day Free Trial
-- Run this in the Supabase SQL Editor (or via supabase migration)

CREATE TABLE IF NOT EXISTS public.trial_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  TEXT,
  license_key TEXT NOT NULL,
  raw_key     TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'trial',
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One trial per user
CREATE UNIQUE INDEX IF NOT EXISTS trial_keys_user_id_unique ON public.trial_keys (user_id);

-- Enable RLS
ALTER TABLE public.trial_keys ENABLE ROW LEVEL SECURITY;

-- Users can read their own trial key
CREATE POLICY "Users can read own trial key"
  ON public.trial_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users cannot insert directly (only the edge function does that via service role)
-- The edge function uses the anon key + user's JWT, so we need an insert policy
-- that allows authenticated users to insert their own row
CREATE POLICY "Users can insert own trial key"
  ON public.trial_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No updates or deletes by users
-- (The edge function handles everything via the user's JWT)
