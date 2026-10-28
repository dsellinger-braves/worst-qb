-- Migration: Enable Account Creation and Claiming Manually Generated Teams
-- Run this script in the Supabase SQL Editor.

-- 1. Add is_claimed column to league_members if not present
ALTER TABLE public.league_members ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT false;

-- 2. Mark existing accounts as claimed, and offline/placeholder members as unclaimed
UPDATE public.league_members 
SET is_claimed = true 
WHERE user_id IN (SELECT id FROM auth.users);

UPDATE public.league_members 
SET is_claimed = false 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 3. Function to retrieve unclaimed / claimable teams in a league
CREATE OR REPLACE FUNCTION public.get_claimable_teams(target_league_id UUID)
RETURNS TABLE (
    user_id UUID,
    team_name TEXT,
    season_points NUMERIC,
    draft_position INTEGER,
    is_admin BOOLEAN,
    is_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lm.user_id,
        lm.team_name,
        lm.season_points,
        lm.draft_position,
        lm.is_admin,
        COALESCE(lm.is_claimed, false) AS is_claimed
    FROM public.league_members lm
    WHERE lm.league_id = target_league_id
      AND (
          lm.is_claimed = false 
          OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = lm.user_id)
      )
    ORDER BY lm.draft_position ASC, lm.team_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_claimable_teams(UUID) TO anon, authenticated;

-- 4. Function for authenticated user to claim an offline team
CREATE OR REPLACE FUNCTION public.claim_league_team(
    target_league_id UUID,
    target_offline_user_id UUID,
    new_team_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_id UUID;
    target_member RECORD;
    existing_membership RECORD;
    final_team_name TEXT;
    overrides JSONB;
BEGIN
    -- 1. Verify caller is authenticated
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be logged in to claim a team.');
    END IF;

    -- 2. Verify target offline team exists in league
    SELECT * INTO target_member 
    FROM public.league_members 
    WHERE league_id = target_league_id AND user_id = target_offline_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Team not found in this league.');
    END IF;

    -- 3. Check if user already owns a team in this league
    SELECT * INTO existing_membership 
    FROM public.league_members 
    WHERE league_id = target_league_id AND user_id = caller_id;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this league (' || existing_membership.team_name || ').');
    END IF;

    -- 4. Ensure team is not already owned by an active auth user
    IF target_member.is_claimed = true AND EXISTS (SELECT 1 FROM auth.users WHERE id = target_offline_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This team has already been claimed by a registered user.');
    END IF;

    final_team_name := COALESCE(NULLIF(TRIM(new_team_name), ''), target_member.team_name);

    -- 5. Reassign league_members row to the caller
    UPDATE public.league_members 
    SET user_id = caller_id,
        team_name = final_team_name,
        is_claimed = true
    WHERE league_id = target_league_id AND user_id = target_offline_user_id;

    -- 6. Reassign all draft_picks from offline UUID to caller
    UPDATE public.draft_picks 
    SET user_id = caller_id 
    WHERE league_id = target_league_id AND user_id = target_offline_user_id;

    -- 7. Update draft_order_overrides in leagues.scoring_settings if present
    SELECT scoring_settings->'draft_order_overrides' INTO overrides
    FROM public.leagues
    WHERE id = target_league_id;

    IF overrides IS NOT NULL THEN
        UPDATE public.leagues
        SET scoring_settings = jsonb_set(
            scoring_settings,
            '{draft_order_overrides}',
            (
                SELECT jsonb_object_agg(
                    key,
                    (
                        SELECT jsonb_agg(
                            CASE 
                                WHEN val::text = ('"' || target_offline_user_id::text || '"') THEN to_jsonb(caller_id::text)
                                ELSE val
                            END
                        )
                        FROM jsonb_array_elements(value) AS val
                    )
                )
                FROM jsonb_each(overrides)
            )
        )
        WHERE id = target_league_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Team claimed successfully!',
        'team_name', final_team_name,
        'user_id', caller_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_league_team(UUID, UUID, TEXT) TO authenticated;

-- 5. Ensure RLS policies allow draft_picks update if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'draft_picks' AND policyname = 'Users or admins can update draft picks'
    ) THEN
        CREATE POLICY "Users or admins can update draft picks" 
        ON public.draft_picks FOR UPDATE 
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
    END IF;
END $$;

-- 6. Helper function to list leagues publicly for signup claim dropdown
CREATE OR REPLACE FUNCTION public.get_public_leagues()
RETURNS TABLE (
    id UUID,
    name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, name FROM public.leagues ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_leagues() TO anon, authenticated;

-- 7. Update RLS policies to allow public (anon + authenticated) to view leagues, members, and draft picks
-- (This enables league preview, standings, and claiming for users before or during signup)
DROP POLICY IF EXISTS "Authenticated users can read leagues" ON public.leagues;
DROP POLICY IF EXISTS "Public read for leagues" ON public.leagues;
CREATE POLICY "Public read for leagues" 
ON public.leagues FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view league members" ON public.league_members;
DROP POLICY IF EXISTS "Public read for league_members" ON public.league_members;
CREATE POLICY "Public read for league_members" 
ON public.league_members FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view draft picks" ON public.draft_picks;
DROP POLICY IF EXISTS "Public read for draft_picks" ON public.draft_picks;
CREATE POLICY "Public read for draft_picks" 
ON public.draft_picks FOR SELECT 
TO anon, authenticated 
USING (true);

