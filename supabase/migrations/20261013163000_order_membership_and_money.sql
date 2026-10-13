-- Membership gate, structured order money, and atomic courier accept.

CREATE OR REPLACE FUNCTION public.has_active_membership(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = _user_id
        AND m.role = _role
        AND m.status = 'active'
        AND m.current_period_end > now()
    )
    OR (
      _role = 'courier'
      AND EXISTS (
        SELECT 1
        FROM public.couriers c
        WHERE c.user_id = _user_id
          AND c.subscription_active = true
          AND c.subscription_expires_at > now()
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.has_active_membership(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_membership(uuid, public.app_role) TO authenticated, service_role;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS food_amount_cents integer,
  ADD COLUMN IF NOT EXISTS shipping_amount_cents integer,
  ADD COLUMN IF NOT EXISTS advance_due_cents integer,
  ADD COLUMN IF NOT EXISTS restaurant_pays_shipping_cents integer,
  ADD COLUMN IF NOT EXISTS collect_on_delivery_cents integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_mode_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_mode_check
      CHECK (payment_mode IS NULL OR payment_mode IN ('prepaid_at_restaurant', 'collect_on_delivery'));
  END IF;
END $$;

DROP POLICY IF EXISTS "orders_insert_restaurant" ON public.orders;

CREATE OR REPLACE FUNCTION public.accept_order_for_courier(_order_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_courier public.couriers%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.has_active_membership(_user_id, 'courier') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'membership_required');
  END IF;

  SELECT * INTO v_courier
  FROM public.couriers
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'courier_not_found');
  END IF;

  IF v_courier.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'courier_inactive');
  END IF;

  UPDATE public.orders
  SET
    courier_id = v_courier.id,
    status = 'assigned',
    accepted_at = now()
  WHERE id = _order_id
    AND status = 'pending'
    AND courier_id IS NULL
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_taken');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'restaurant_id', v_order.restaurant_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_order_for_courier(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order_for_courier(uuid, uuid) TO service_role;
