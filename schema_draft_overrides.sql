ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS draft_order_overrides JSONB DEFAULT '{}'::jsonb;
