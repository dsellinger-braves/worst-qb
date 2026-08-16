-- Worst QB Fantasy Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Leagues Table
CREATE TABLE public.leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_week INTEGER DEFAULT 1,
    draft_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed'
    scoring_type TEXT DEFAULT 'individual' -- 'individual', 'team_qb'
);

-- 2. League Members (Tracks Season Long Points)
CREATE TABLE public.league_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    team_name TEXT,
    season_points NUMERIC DEFAULT 0,
    draft_position INTEGER, -- Order in the draft
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(league_id, user_id)
);

-- 3. Players (NFL QBs)
CREATE TABLE public.players (
    id TEXT PRIMARY KEY, -- We'll use the ID from our data provider (e.g. nfl_data_py gsis_id)
    name TEXT NOT NULL,
    team TEXT,
    position TEXT DEFAULT 'QB',
    status TEXT DEFAULT 'active'
);

-- 4. Draft Picks (Weekly Matches)
CREATE TABLE public.draft_picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES public.leagues(id),
    user_id UUID REFERENCES auth.users(id),
    player_id TEXT REFERENCES public.players(id),
    week INTEGER NOT NULL,
    pick_number INTEGER, -- e.g., 1 or 2 for the two QBs
    picked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(league_id, user_id, week, pick_number), -- A user can't have two pick 1s in a week
    UNIQUE(league_id, player_id, week) -- Unique players per league per week
);

-- 5. Player Stats & Points (Live updated)
CREATE TABLE public.player_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT REFERENCES public.players(id),
    week INTEGER NOT NULL,
    passing_yards INTEGER DEFAULT 0,
    passing_tds INTEGER DEFAULT 0,
    interceptions INTEGER DEFAULT 0,
    pick_sixes INTEGER DEFAULT 0,
    rushing_yards INTEGER DEFAULT 0,
    rushing_tds INTEGER DEFAULT 0,
    fumbles_lost INTEGER DEFAULT 0,
    sacks INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    completion_percentage NUMERIC DEFAULT 0,
    team_loss BOOLEAN DEFAULT FALSE,
    custom_points NUMERIC DEFAULT 0, -- The calculated "Worst QB" score
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, week)
);

-- RLS (Row Level Security) Policies
-- Ensure to enable RLS on all tables and configure policies for the web app in Supabase dashboard.
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users for most things
CREATE POLICY "Allow read access for authenticated users" ON public.leagues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.league_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.draft_picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.player_stats FOR SELECT TO authenticated USING (true);

-- Allow users to join leagues (insert into league_members)
CREATE POLICY "Users can insert their own membership" ON public.league_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow users to make draft picks for themselves
CREATE POLICY "Users can insert their own draft picks" ON public.draft_picks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
