-- Add attempts and completions
ALTER TABLE public.player_stats 
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completions INTEGER DEFAULT 0;

-- Create player_projections table
CREATE TABLE IF NOT EXISTS public.player_projections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT REFERENCES public.players(id),
    week INTEGER NOT NULL,
    projected_custom_points NUMERIC DEFAULT 0,
    opponent TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, week)
);

-- Enable RLS for pvlayer_projections
ALTER TABLE public.player_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on projections"
ON public.player_projections FOR SELECT
USING (true);

CREATE POLICY "Enable insert/update for anon on projections"
ON public.player_projections FOR ALL
USING (true)
WITH CHECK (true);
