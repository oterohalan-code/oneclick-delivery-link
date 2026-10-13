export type PaymentMode = "prepaid_at_restaurant" | "collect_on_delivery";

export function pesosToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function computeOrderMoney(input: {
  mode: PaymentMode;
  foodMxn: number;
  shippingMxn: number;
}) {
  const food_amount_cents = pesosToCents(input.foodMxn);
  const shipping_amount_cents = pesosToCents(input.shippingMxn);
  if (input.mode === "prepaid_at_restaurant") {
    return {
      payment_mode: input.mode,
      food_amount_cents,
      shipping_amount_cents,
      advance_due_cents: 0,
      restaurant_pays_shipping_cents: shipping_amount_cents,
      collect_on_delivery_cents: 0,
      amount_to_collect: 0,
    };
  }
  return {
    payment_mode: input.mode,
    food_amount_cents,
    shipping_amount_cents,
    advance_due_cents: 0,
    restaurant_pays_shipping_cents: 0,
    collect_on_delivery_cents: food_amount_cents + shipping_amount_cents,
    amount_to_collect: input.foodMxn + input.shippingMxn,
  };
}
