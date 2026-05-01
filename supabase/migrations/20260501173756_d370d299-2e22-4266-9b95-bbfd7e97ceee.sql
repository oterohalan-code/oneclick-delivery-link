-- Función SECURITY DEFINER para verificar si el usuario actual es dueño
-- de un restaurante con un pedido asignado a este repartidor.
-- Bypassa RLS para romper el ciclo couriers ↔ orders ↔ restaurants.
CREATE OR REPLACE FUNCTION public.restaurant_owns_order_for_courier(_courier_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.courier_id = _courier_id
      AND r.user_id = _user_id
  )
$$;

-- Reemplazar política de SELECT que provocaba recursión
DROP POLICY IF EXISTS couriers_select_own_or_admin_or_assigned_restaurant ON public.couriers;

CREATE POLICY couriers_select_own_or_admin_or_assigned_restaurant
ON public.couriers
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.restaurant_owns_order_for_courier(couriers.id, auth.uid())
);