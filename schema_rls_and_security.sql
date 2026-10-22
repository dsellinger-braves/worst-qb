-- Worst QB - Comprehensive Row Level Security (RLS) & Public Access Migration
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)

-- 1. Ensure RLS is enabled on all tables
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing conflicting/outdated policies
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.leagues;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.league_members;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.players;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.draft_picks;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.player_stats;
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.league_members;
DROP POLICY IF EXISTS "Users can insert their own draft picks" ON public.draft_picks;
DROP POLICY IF EXISTS "Enable read access for all users on projections" ON public.player_projections;
DROP POLICY IF EXISTS "Enable insert/update for anon on projections" ON public.player_projections;

-- 3. Public Data: Allow public (anon + authenticated) to view Players, Stats, and Projections
CREATE POLICY "Public read for players" 
ON public.players FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Public read for player_stats" 
ON public.player_stats FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Public read for player_projections" 
ON public.player_projections FOR SELECT 
TO anon, authenticated 
USING (true);

-- 4. League Data: Leagues
CREATE POLICY "Authenticated users can read leagues" 
ON public.leagues FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create leagues" 
ON public.leagues FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their leagues" 
ON public.leagues FOR UPDATE 
TO authenticated 
USING (
    auth.uid() = created_by 
    OR EXISTS (
        SELECT 1 FROM public.league_members 
        WHERE league_members.league_id = leagues.id 
          AND league_members.user_id = auth.uid() 
          AND league_members.is_admin = true
    )
);

-- 5. League Data: League Members
CREATE POLICY "Authenticated users can view league members" 
ON public.league_members FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can join leagues or admins can add members" 
ON public.league_members FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.leagues 
        WHERE leagues.id = league_members.league_id 
          AND leagues.created_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.league_members lm 
        WHERE lm.league_id = league_members.league_id 
          AND lm.user_id = auth.uid() 
          AND lm.is_admin = true
    )
);

CREATE POLICY "Members or admins can update season points / membership" 
ON public.league_members FOR UPDATE 
TO authenticated 
USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.leagues 
        WHERE leagues.id = league_members.league_id 
          AND leagues.created_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.league_members lm 
        WHERE lm.league_id = league_members.league_id 
          AND lm.user_id = auth.uid() 
          AND lm.is_admin = true
    )
);

-- 6. League Data: Draft Picks
CREATE POLICY "Authenticated users can view draft picks" 
ON public.draft_picks FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users or admins can draft players" 
ON public.draft_picks FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.leagues 
        WHERE leagues.id = draft_picks.league_id 
          AND leagues.created_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.league_members 
        WHERE league_members.league_id = draft_picks.league_id 
          AND league_members.user_id = auth.uid() 
          AND league_members.is_admin = true
    )
);

CREATE POLICY "Users or admins can undo draft picks" 
ON public.draft_picks FOR DELETE 
TO authenticated 
USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.leagues 
        WHERE leagues.id = draft_picks.league_id 
          AND leagues.created_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.league_members 
        WHERE league_members.league_id = draft_picks.league_id 
          AND league_members.user_id = auth.uid() 
          AND league_members.is_admin = true
    )
);
