# Admin Screen Inventory

| ID | Screen | Purpose | Primary states | APIs / gate |
|---|---|---|---|---|
| AUTH-01 | Sign in | Establish an Admin session | idle, validating, invalid, unverified, disabled, server error | `POST /api/auth/login`, then role check |
| AUTH-02 | Access denied | Explain insufficient role/session | denied, session expired | local guard; backend 401/403 |
| DASH-01 | Dashboard | Route administrators to attention items | loading, no supported metrics, partial, failed | aggregation APIs missing |
| USER-01 | User accounts | Search/filter all accounts and change supported status | loading, empty, filtered-empty, failed, ready | `GET /api/admin/users/` |
| USER-02 | User details | Show identity, roles, verification, and lifecycle | loading, not found, ready | composed from Admin user list; no detail endpoint |
| USER-03 | Account status confirmation | Enable/disable a non-self account | confirm, saving, conflict/error, success | `PATCH /api/admin/users/{id}/status` |
| ROUTE-01 | Routes & directions | Review canonical network records | loading, empty, failed, ready | `GET /api/admin/transit-routes` |
| ROUTE-02 | Route details | Inspect metadata and directions | loading, not found, ready | composed from Admin route list |
| ROUTE-03 | Create/edit route | Manage approved metadata/status/color | pristine, dirty, invalid, saving, conflict | POST/PATCH Admin transit routes |
| ROUTE-04 | Direction editor | Manage endpoints, corridor, status | pristine, dirty, invalid, saving | POST/PATCH route direction |
| ROUTE-05 | Geometry editor | Display/edit/import one LineString | loading, editing, invalid, dirty, saving, recovery | direction PATCH; no stop contract |
| VEH-01 | Vehicle registry | Search/filter permitted jeepneys | loading, empty, failed, ready | `GET /api/jeepneys` |
| VEH-02 | Vehicle details | Inspect vehicle, route, and workflow context | partial, loading, failed, ready | jeepney list + effective route + application lists |
| GROUP-01 | Fleet groups | Review and manage groups | loading, empty, failed, ready | fleet-group GET/POST/PATCH |
| OP-01 | Operators | Monitor Operator accounts | loading, empty, failed, ready | filtered Admin users (implemented); `operators.id` not linkable to accounts until G1 — contract-gate notice shown |
| DRV-01 | Drivers | Monitor Driver accounts | loading, empty, failed, ready | filtered Admin users (implemented); `drivers.id` not linkable to accounts until G1 — contract-gate notice shown |
| APP-01 | Vehicle applications | Review application queue | loading, empty, failed, ready | vehicle-application GET |
| APP-02 | Vehicle review | Approve/reject a pending application | loading, reviewable, completed, saving, conflict | Admin review PATCH |
| GPS-01 | GPS setup queue | Filter setup and verification states | loading, empty, failed, ready | GPS request GET |
| GPS-02 | GPS setup details | Transition, map device, verify checks | loading, gated action, saving, conflict, complete | Admin status/mapping/verification operations |
| TRACK-01 | Live fleet map | Inspect approved latest state | blocked, later loading/stale/disconnected | Agent B gate |
| TRACK-02 | Position history | Inspect approved retained history | blocked | Agent B gate |
| TRACK-03 | Route compliance | Inspect deviation/re-entry | blocked | Agent B gate |
| HEALTH-01 | Integration status | Distinguish service health | base API only, partial, failed | `GET /api/health`; component contracts missing |

Every list and detail screen includes explicit loading, error/retry, empty/not-found, and permission-denied handling. Create/edit screens use dedicated routes except concise status confirmations.
