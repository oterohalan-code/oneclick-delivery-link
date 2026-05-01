ALTER TABLE public.orders
  ADD COLUMN customer_name TEXT,
  ADD COLUMN customer_phone TEXT,
  ADD COLUMN customer_phone_dial_code TEXT NOT NULL DEFAULT '+52';