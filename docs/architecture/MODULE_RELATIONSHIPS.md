# Module Relationships

## Angular boundaries

| Area | Owns | Depends on |
|---|---|---|
| Core | configuration, HTTP/auth interceptors, session state, guards | approved API contracts |
| Shell | toolbar, drawer, route outlet, navigation policy | Core auth state |
| Shared UI | status, page heading, loading/empty/error/denied patterns | Angular Material/CDK |
| Identity | user account list/detail/status | Agent A Admin users/auth |
| Fleet | vehicles, groups, operator/driver context | Agent A fleet + Identity links |
| Transit | routes, directions, geometry drafts | Agent A transit; MapLibre |
| Applications | vehicle/GPS queues and review | Agent A vehicle workflow + Fleet links |
| Tracking | live map/history/compliance | Agent B; production routes withheld |
| System | supported health/integration views | base health now; richer contracts pending |

## Domain graph

`Operator account → fleet groups → jeepneys → driver assignment`

`Jeepney → effective route direction → GPS/vehicle application state`

`Transit route → directions → LineString geometry + corridor → vehicle/group assignments`

`Vehicle application → applicant + jeepney → Admin decision → GPS setup → device mapping → verification`

`Tracking map → selected jeepney → approved latest state + effective route` (Agent B-gated)

Stops have no approved entity/API and therefore are not an implemented node in this graph.

## Navigation and data rules

- Related records are linked by identifiers already returned by approved APIs.
- Features do not duplicate another domain's edit surface.
- Effective-route precedence is always obtained from the backend resolver.
- Route geometry drafts stay local until explicit validation and save.
- Server-side RBAC remains authoritative regardless of navigation visibility.
