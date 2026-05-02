-- Tabla de referidos
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  referred_by_user_id uuid,
  reward_granted boolean NOT NULL DEFAULT false,
  reward_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_code ON public.referrals(code);
CREATE INDEX idx_referrals_referred_by ON public.referrals(referred_by_user_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_select_own_or_lookup
  ON public.referrals FOR SELECT TO authenticated
  USING (true);

CREATE POLICY referrals_insert_own
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY referrals_update_admin
  ON public.referrals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Generador de código corto único
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    v_code := upper(substring(replace(replace(replace(encode(gen_random_bytes(6),'base64'),'/',''),'+',''),'=','') from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.referrals WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Recompensa al primer pedido entregado del referido (solo couriers)
CREATE OR REPLACE FUNCTION public.grant_referral_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_courier_user_id uuid;
  v_referrer_user_id uuid;
  v_referrer_courier_id uuid;
  v_completed_count int;
  v_new_balance numeric;
BEGIN
  IF NEW.status <> 'delivered' OR (TG_OP = 'UPDATE' AND OLD.status = 'delivered') THEN
    RETURN NEW;
  END IF;
  IF NEW.courier_id IS NULL THEN RETURN NEW; END IF;

  SELECT user_id INTO v_courier_user_id FROM public.couriers WHERE id = NEW.courier_id;
  IF v_courier_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT referred_by_user_id INTO v_referrer_user_id
  FROM public.referrals
  WHERE user_id = v_courier_user_id AND reward_granted = false AND referred_by_user_id IS NOT NULL;

  IF v_referrer_user_id IS NULL THEN RETURN NEW; END IF;

  -- Confirmar que es el primer pedido completado de este courier
  SELECT count(*) INTO v_completed_count FROM public.orders
  WHERE courier_id = NEW.courier_id AND status = 'delivered';
  IF v_completed_count <> 1 THEN RETURN NEW; END IF;

  -- Buscar courier del referente para acreditar wallet
  SELECT id INTO v_referrer_courier_id FROM public.couriers WHERE user_id = v_referrer_user_id;
  IF v_referrer_courier_id IS NOT NULL THEN
    UPDATE public.couriers
    SET wallet_balance = wallet_balance + 50, updated_at = now()
    WHERE id = v_referrer_courier_id
    RETURNING wallet_balance INTO v_new_balance;

    INSERT INTO public.wallet_transactions (courier_id, type, amount, balance_after, description, order_id)
    VALUES (v_referrer_courier_id, 'credit', 50, v_new_balance, 'Recompensa por referido', NEW.id);
  END IF;

  UPDATE public.referrals
  SET reward_granted = true, reward_granted_at = now()
  WHERE user_id = v_courier_user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grant_referral_reward
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.grant_referral_reward();

-- Conversaciones de soporte
CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_conv_user ON public.support_conversations(user_id, created_at DESC);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_conv_own
  ON public.support_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_support_conv_updated
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mensajes de soporte
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_msg_conv ON public.support_messages(conversation_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_msg_select_own
  ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_conversations c
                 WHERE c.id = conversation_id AND c.user_id = auth.uid()));

CREATE POLICY support_msg_insert_own
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_conversations c
                      WHERE c.id = conversation_id AND c.user_id = auth.uid()));