-- Migration: Auto-confirm users and instructions to disable email rate limits
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)

-- 1. Auto-confirm any existing users who haven't confirmed their email
-- This ensures all users can immediately sign in with their password without being blocked
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 2. IMPORTANT DASHBOARD STEP TO PREVENT EMAIL RATE LIMITS:
-- Supabase enforces a strict 3-4 email/hour limit on its free tier built-in email service.
-- To completely stop Supabase from attempting to send emails and exceeding rate limits:
--
-- Go to Supabase Dashboard:
-- 1. Click "Authentication" in the left sidebar
-- 2. Click "Providers" -> "Email"
-- 3. Toggle OFF: "Confirm email"
-- 4. Toggle OFF: "Secure email change"
-- 5. Click "Save" at the bottom
--
-- Once "Confirm email" is toggled OFF, all new signups are immediately active 
-- without sending ANY emails, completely eliminating the "email rate limit exceeded" error!
