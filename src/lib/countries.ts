export interface Country {
  code: string; // ISO-2
  name: string;
  dial: string; // e.g. "+52"
  flag: string; // emoji
}

// Curated list, México first (default)
export const COUNTRIES: Country[] = [
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { code: "US", name: "Estados Unidos", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canadá", dial: "+1", flag: "🇨🇦" },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹" },
  { code: "SV", name: "El Salvador", dial: "+503", flag: "🇸🇻" },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳" },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮" },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷" },
  { code: "PA", name: "Panamá", dial: "+507", flag: "🇵🇦" },
  { code: "CU", name: "Cuba", dial: "+53", flag: "🇨🇺" },
  { code: "DO", name: "República Dominicana", dial: "+1", flag: "🇩🇴" },
  { code: "PR", name: "Puerto Rico", dial: "+1", flag: "🇵🇷" },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { code: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨" },
  { code: "PE", name: "Perú", dial: "+51", flag: "🇵🇪" },
  { code: "BO", name: "Bolivia", dial: "+591", flag: "🇧🇴" },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "ES", name: "España", dial: "+34", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "FR", name: "Francia", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Alemania", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Italia", dial: "+39", flag: "🇮🇹" },
  { code: "GB", name: "Reino Unido", dial: "+44", flag: "🇬🇧" },
  { code: "NL", name: "Países Bajos", dial: "+31", flag: "🇳🇱" },
  { code: "JP", name: "Japón", dial: "+81", flag: "🇯🇵" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountryByCode(code: string | null | undefined): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
}
