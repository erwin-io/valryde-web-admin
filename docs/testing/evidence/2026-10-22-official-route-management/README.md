# Evidence — Official route and direction management (ID 61)

Captured 2026-10-22 from `ng serve` at 1280 px against a throwaway local stub (not committed) that mimics Agent A's Admin transit responses. **All routes are synthetic fixtures** ("Synthetic …" names). **Not evidence of real backend integration.**

| File | Shows |
|---|---|
| `01-routes-list.jpg` | All statuses, color, direction counts, New route action |
| `02-route-detail.jpg` | Route fields, directions with line size and edit links |
| `03-duplicate-route-code.jpg` | Stub `409 CONFLICT` mapped to the route-code field with request ID; entered values kept |
| `04-unsaved-changes-guard.jpg` | Discard prompt when leaving a dirty form |

Also verified in the browser against the stub (DOM assertions; screenshots unavailable because the app window was hidden):

- Status change to Inactive → confirmation "10F will no longer appear in commuter route lists" → PATCH → detail page re-reads the list and shows Inactive (read-after-write) with a success snackbar.
- Direction rename to a label already used on the route → "Another direction on this route already uses this name." and no PATCH sent.
