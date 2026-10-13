-- Memberships for restaurant ($450) and courier ($300).
-- Mercado Pago is the writer. Client cannot insert or update these rows.

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'active', 'past_due', 'cancelled')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  current_period_start timestamptz,
  current_period_end timestamptz,
  auto_renew boolean NOT NULL DEFAULT false,
  mp_preapproval_id text,
  provider text NOT NULL DEFAULT 'mercadopago',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role),
  CHECK (role IN ('restaurant', 'courier'))
);

CREATE TABLE IF NOT EXISTS public.membership_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  mode text NOT NULL CHECK (mode IN ('manual', 'auto')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  external_reference text NOT NULL UNIQUE,
  mp_preference_id text,
  mp_preapproval_id text,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'redirected', 'paid', 'failed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role IN ('restaurant', 'courier'))
);

CREATE TABLE IF NOT EXISTS public.membership_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_payment_id text NOT NULL UNIQUE,
  intent_id uuid REFERENCES public.membership_intents(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.membership_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_key text NOT NULL UNIQUE,
  topic text NOT NULL,
  resource_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS membership_intents_user_id_idx ON public.membership_intents(user_id);
CREATE INDEX IF NOT EXISTS membership_payments_user_id_idx ON public.membership_payments(user_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_select_own ON public.memberships;
CREATE POLICY memberships_select_own ON public.memberships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS membership_intents_select_own ON public.membership_intents;
CREATE POLICY membership_intents_select_own ON public.membership_intents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS membership_payments_select_own ON public.membership_payments;
CREATE POLICY membership_payments_select_own ON public.membership_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.memberships FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.membership_intents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.membership_payments FROM anon, authenticated;
REVOKE ALL ON public.membership_webhook_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_membership_payment(
  p_provider_payment_id text,
  p_external_reference text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz,
  p_mp_preapproval_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_intent public.membership_intents%ROWTYPE;
  v_membership public.memberships%ROWTYPE;
  v_payment_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_now timestamptz := coalesce(p_paid_at, now());
BEGIN
  IF p_currency IS DISTINCT FROM 'MXN' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'currency');
  END IF;

  SELECT * INTO v_intent
  FROM public.membership_intents
  WHERE external_reference = p_external_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'intent_not_found');
  END IF;

  IF p_amount_cents IS DISTINCT FROM v_intent.amount_cents THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  END IF;

  INSERT INTO public.membership_payments (
    provider_payment_id, intent_id, user_id, amount_cents, currency, status, paid_at
  ) VALUES (
    p_provider_payment_id, v_intent.id, v_intent.user_id, p_amount_cents, p_currency, 'approved', v_now
  )
  ON CONFLICT (provider_payment_id) DO NOTHING
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_applied');
  END IF;

  SELECT * INTO v_membership
  FROM public.memberships
  WHERE user_id = v_intent.user_id AND role = v_intent.role
  FOR UPDATE;

  IF FOUND AND v_membership.current_period_end IS NOT NULL AND v_membership.current_period_end > v_now THEN
    v_period_start := v_membership.current_period_start;
    v_period_end := v_membership.current_period_end + interval '1 month';
  ELSE
    v_period_start := v_now;
    v_period_end := v_now + interval '1 month';
  END IF;

  INSERT INTO public.memberships (
    user_id, role, status, amount_cents, currency,
    current_period_start, current_period_end, auto_renew, mp_preapproval_id, provider, updated_at
  ) VALUES (
    v_intent.user_id,
    v_intent.role,
    'active',
    v_intent.amount_cents,
    v_intent.currency,
    v_period_start,
    v_period_end,
    v_intent.mode = 'auto' OR coalesce(v_membership.auto_renew, false),
    coalesce(p_mp_preapproval_id, v_intent.mp_preapproval_id, v_membership.mp_preapproval_id),
    'mercadopago',
    now()
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    status = 'active',
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    auto_renew = public.memberships.auto_renew OR excluded.auto_renew,
    mp_preapproval_id = coalesce(excluded.mp_preapproval_id, public.memberships.mp_preapproval_id),
    provider = 'mercadopago',
    updated_at = now()
  RETURNING * INTO v_membership;

  UPDATE public.membership_payments
  SET membership_id = v_membership.id
  WHERE id = v_payment_id;

  UPDATE public.membership_intents
  SET status = 'paid'
  WHERE id = v_intent.id;

  IF v_intent.role = 'courier' THEN
    UPDATE public.couriers
    SET
      subscription_active = true,
      subscription_expires_at = v_period_end,
      plan = 'subscription',
      updated_at = now()
    WHERE user_id = v_intent.user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'applied',
    'membership_id', v_membership.id,
    'period_end', v_period_end
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_membership_payment(text, text, integer, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_membership_payment(text, text, integer, text, timestamptz, text) TO service_role;
