# Premium visual refresh
- [x] Refine shared typography, surfaces, controls, and navigation without changing behavior.
- [x] Apply the visual treatment to public directory, access, and operational screens.
- [x] Verify desktop/mobile rendering and existing navigation; address current compile blocker without changing runtime logic.

Verification: public search and signup selection; authenticated administrator finance and profile navigation; restaurant panel with real requests; courier onboarding; no horizontal overflow. Active courier deliveries and payment execution were not exercised because this request changes appearance only.

# Restaurant details correction
- [x] Add editable business name, address, and phone to the public-page editor with saved-value preview.
- [x] Verify owner saving and reloading the details without changing orders or memberships.

Verification: authenticated owner saved Taquería El Güero and reloaded its persisted name; existing address preserved pending the real Manzanillo address. Mobile fields render without horizontal overflow; no browser errors; build OK.