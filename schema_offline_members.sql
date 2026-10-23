-- Migration: Allow Offline / Non-Account Members and Commissioner Drafting
-- Run this script in the Supabase SQL Editor.
-- 
-- This drops the foreign key constraints from league_members.user_id and draft_picks.user_id
-- to auth.users(id). This allows commissioners to add team owners who do not have Supabase accounts
-- (using generated UUIDs), draft on their behalf, and track their weekly scores and season standings.

-- 1. Drop foreign key constraint on league_members (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'league_members_user_id_fkey' 
          AND table_name = 'league_members'
    ) THEN
        ALTER TABLE public.league_members DROP CONSTRAINT league_members_user_id_fkey;
    END IF;
END $$;

-- 2. Drop foreign key constraint on draft_picks (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'draft_picks_user_id_fkey' 
          AND table_name = 'draft_picks'
    ) THEN
        ALTER TABLE public.draft_picks DROP CONSTRAINT draft_picks_user_id_fkey;
    END IF;
END $$;
