-- Run this in the Supabase SQL editor to add the new scoring_type column and the missing attempts/completions columns
ALTER TABLE public.leagues ADD COLUMN scoring_type TEXT DEFAULT 'individual';

ALTER TABLE public.player_stats ADD COLUMN attempts INTEGER DEFAULT 0;
ALTER TABLE public.player_stats ADD COLUMN completions INTEGER DEFAULT 0;
