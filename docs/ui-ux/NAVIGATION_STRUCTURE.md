# Navigation Structure

Production navigation exposes only functional MVP routes. Disabled placeholders do not masquerade as live features.

| Group | Route | Screen | Contract state |
|---|---|---|---|
| Dashboard | `/dashboard` | System overview | Shell available; live metrics blocked pending aggregation contracts |
| Transit Network | `/transit/routes` | Routes & directions list | Agent A available |
| Transit Network | `/transit/routes/:routeId` | Route details | Agent A available through Admin list payload |
| Transit Network | `/transit/routes/:routeId/edit` | Route metadata editor | Agent A available |
| Transit Network | `/transit/directions/:directionId/geometry` | Geometry editor | Agent A available; active-assignment warning data incomplete |
| Fleet Management | `/fleet/vehicles` | Jeepney registry | Agent A available |
| Fleet Management | `/fleet/vehicles/:vehicleId` | Vehicle details | Partial; compose list plus effective-route endpoints |
| Fleet Management | `/fleet/groups` | Fleet groups | Agent A available |
| Fleet Management | `/fleet/operators` | Operators | Implemented (account-level, links to account record); fleet context gated on Agent A G1 directory (API PR #8, proposal) |
| Fleet Management | `/fleet/drivers` | Drivers | Implemented (account-level, links to account record); assignments/membership gated on Agent A G1/G2 |
| Applications & Approvals | `/applications/vehicles` | Vehicle applications | Agent A available |
| Applications & Approvals | `/applications/vehicles/:applicationId` | Vehicle application review | Agent A list + review available |
| Applications & Approvals | `/applications/gps` | GPS setup queue | Agent A available |
| Applications & Approvals | `/applications/gps/:requestId` | GPS installation review | Agent A transitions/mapping/verification available |
| Identity & Access | `/identity/users` | User accounts | Agent A available; first implemented module |
| Tracking Operations | — | Live map/history/compliance | Hidden until Agent B contracts are approved |
| System Administration | `/system/health` | Integration status | Base API health only; component health blocked |

Stops are relationship context only. No Stops navigation or production screen is created because no stop entity or API exists in the approved MVP backend.

## Navigation behavior

- Authentication routes are outside the shell: `/sign-in` and `/access-denied`.
- All shell routes require an authenticated user with the `ADMIN` role.
- Direct navigation to an unauthorized page resolves to the access-denied screen.
- Drawer group labels remain visible when expanded and are announced accessibly when collapsed.
- The active page and parent group are visually identified.
- Breadcrumbs reflect business hierarchy, not URL fragments.

## Future modules

Booking, payment/transactions, revenue, ridership analytics, scorecards, dispatch, fare collection, optimization, and alert management remain documentation-only concepts and are excluded from production navigation.
