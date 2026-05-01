-- Columns for courier earnings & route distance
ALTER TABLE public.orders
  ADD COLUMN shipping_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN distance_km NUMERIC;

-- Chat table
CREATE TABLE public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('restaurant','courier')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_messages_order_created ON public.order_messages(order_id, created_at);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a participant of this order?
CREATE OR REPLACE FUNCTION public.is_order_participant(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.couriers   c ON c.id = o.courier_id
    WHERE o.id = _order_id
      AND (r.user_id = _user_id OR c.user_id = _user_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_order_participant(uuid, uuid) FROM anon;

CREATE POLICY order_messages_select_participants
  ON public.order_messages FOR SELECT TO authenticated
  USING (public.is_order_participant(order_id, auth.uid()));

CREATE POLICY order_messages_insert_participants
  ON public.order_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_order_participant(order_id, auth.uid())
  );

-- Realtime
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;