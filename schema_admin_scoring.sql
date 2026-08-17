-- Run this in the Supabase SQL editor to add the new admin roles and scoring settings
ALTER TABLE public.league_members ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS scoring_settings JSONB DEFAULT '{
  "pass_yds": -0.05,
  "pass_tds": -5.0,
  "ints": 3.0,
  "pick_sixes": 5.0,
  "rush_yds": -0.1,
  "rush_tds": -5.0,
  "fumbles_lost": 3.0,
  "sacks": 1.0,
  "team_loss": 5.0,
  "no_attempts": -20.0,
  "completion_penalty_multiplier": 20.0
}'::jsonb;
