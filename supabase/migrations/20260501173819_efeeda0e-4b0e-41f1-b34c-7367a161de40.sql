REVOKE EXECUTE ON FUNCTION public.restaurant_owns_order_for_courier(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurant_owns_order_for_courier(uuid, uuid) TO authenticated;