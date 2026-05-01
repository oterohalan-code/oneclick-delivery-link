
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS circulation_url text,
  ADD COLUMN IF NOT EXISTS has_backpack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS willing_to_get_backpack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_validation jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'MX',
  ADD COLUMN IF NOT EXISTS phone_dial_code text NOT NULL DEFAULT '+52';
