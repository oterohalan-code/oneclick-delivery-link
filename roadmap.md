# Premium visual refresh
- [x] Refine shared typography, surfaces, controls, and navigation without changing behavior.
- [x] Apply the visual treatment to public directory, access, and operational screens.
- [x] Verify desktop/mobile rendering and existing navigation; address current compile blocker without changing runtime logic.

Verification: public search and signup selection; authenticated administrator finance and profile navigation; restaurant panel with real requests; courier onboarding; no horizontal overflow. Active courier deliveries and payment execution were not exercised because this request changes appearance only.

# Restaurant details correction
- [x] Add editable business name, address, and phone to the public-page editor with saved-value preview.
- [x] Verify owner saving and reloading the details without changing orders or memberships.

Verification: authenticated owner saved Taquería El Güero and reloaded its persisted name; existing address preserved pending the real Manzanillo address. Mobile fields render without horizontal overflow; no browser errors; build OK.

# Remove Cancun operational data
- [x] Cancel the Cancun courier order and clear Cancun location references while preserving accounts and El Güero.
- [x] Verify cancellation and absence of Cancun operational locations.

Removed Cancun addresses, coordinates and business Maps link; retained cancelled order history, accounts, menus and memberships. Owner must supply actual Manzanillo address. Courier browser has no Cancun content but lacks active membership in the connected account; cancellation independently verified in database.

# Resolve order locations
- [x] Save confirmed Manzanillo pickup coordinates for Taquería El Güero.
- [x] Resolve shared Google Maps links in customer orders and the owner editor; prevent stale coordinates and quotes.
- [x] Explain missing pickup locations and route failures; verify quote and payment displays without publishing a real delivery.

Verification: confirmed saved pickup coordinates; five link-parser tests passed; build OK. Authenticated owner reviewed an existing prepaid customer request: shipping $48, restaurant payment notice $48, locked customer payment mode, request button enabled, no runtime errors. Did not publish a delivery or charge anyone. Live Google short-link resolution remains unverified in the sandbox and must be checked on the authorized deployed origin.