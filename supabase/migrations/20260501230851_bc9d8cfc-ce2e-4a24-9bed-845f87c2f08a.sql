
-- Stripe subscriptions table (separate from existing 'subscriptions' table to avoid breaking current wallet logic)
CREATE TABLE public.stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_subscriptions_user_id ON public.stripe_subscriptions(user_id);
CREATE INDEX idx_stripe_subscriptions_stripe_id ON public.stripe_subscriptions(stripe_subscription_id);

ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_subs_select_own_or_admin"
  ON public.stripe_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_updated_at_stripe_subscriptions
  BEFORE UPDATE ON public.stripe_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Track checkout sessions for idempotent webhook processing
CREATE TABLE public.stripe_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  courier_id uuid,
  price_id text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'mxn',
  purpose text NOT NULL, -- 'wallet_topup' | 'subscription'
  status text NOT NULL DEFAULT 'pending', -- pending | completed | failed
  environment text NOT NULL DEFAULT 'sandbox',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkout_sessions_user ON public.stripe_checkout_sessions(user_id);
CREATE INDEX idx_checkout_sessions_courier ON public.stripe_checkout_sessions(courier_id);

ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkout_sessions_select_own_or_admin"
  ON public.stripe_checkout_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "checkout_sessions_insert_own"
  ON public.stripe_checkout_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
