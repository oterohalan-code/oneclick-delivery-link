/** Commercial rules for the Manzanillo operation. Do not invent extra fees here. */
export const BUSINESS = {
  brandName: "One Click",
  city: "Manzanillo",
  state: "Colima",
  country: "México",
  coverageLabel: "Manzanillo, Colima",
  currency: "MXN",
  membership: {
    restaurantMonthlyMxn: 450,
    courierMonthlyMxn: 300,
  },
  takesOrderCommission: false,
  mapCenter: [19.1076, -104.3385] as [number, number],
  addressSearchBias: "Manzanillo, Colima, México",
  publicSiteUrl: "https://oneclick.punchingsolutions.com.mx",
} as const;

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}
