-- Update player_stats to support season_type
ALTER TABLE public.player_stats 
ADD COLUMN IF NOT EXISTS season_type TEXT DEFAULT 'regular';

-- Drop the old unique constraint that only checked player_id and week
ALTER TABLE public.player_stats 
DROP CONSTRAINT IF EXISTS player_stats_player_id_week_key;

-- Add the new unique constraint that includes season_type
ALTER TABLE public.player_stats 
ADD CONSTRAINT player_stats_player_id_week_season_type_key UNIQUE (player_id, week, season_type);
