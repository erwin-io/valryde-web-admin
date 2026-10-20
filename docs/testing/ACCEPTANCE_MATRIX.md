# Acceptance Matrix

| Workflow / area | Automated evidence required | Manual/responsive evidence | Current state |
|---|---|---|---|
| W-01 Admin sign-in | auth service, guard, interceptor, non-Admin rejection tests | keyboard and tablet shell | Planned in shell stage |
| W-02 Vehicle registry | typed adapter, loading/error/empty/filter tests | table at desktop/tablet | Planned |
| W-03 Operator context | role filtering and safe missing-contract state | related links | Planned |
| W-04 Driver context | role filtering and missing-assignment state | related links | Planned |
| W-05 Route details | nested direction rendering and failure states | hierarchy clarity | Planned |
| W-06 Geometry edit | LineString validation, dirty guard, save/error recovery | MapLibre pointer/keyboard checks | Planned |
| W-07 Application review | allowed decisions, confirmation, 409 preservation | review layout | Planned |
| W-08 GPS installation | transition/mapping/verification validation | multi-step clarity | Planned |
| W-09 Live tracking | ordering, freshness, disconnect, reconcile | map bounds and stale state | BLOCKED by Agent B |
| W-10 Unauthorized | route guard, 401 redirect, 403 state | direct URL behavior | Planned in shell stage |
| W-11 Errors | structured API error/request ID and form retention | actionable copy | Planned in shared/core stage |
| User accounts module | list, search, role/status filters, enable/disable, self-disable guard, loading/empty/error | responsive columns and dialog focus | First implementation module |
| Quality gates | lint, strict typecheck, unit tests, production build | visual acceptance checklist | Required per PR |

No GPS hardware or deployed Traccar result is an automated frontend acceptance claim. Those checks remain owner/operator evidence.
