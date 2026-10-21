# Valryde Admin

Administrative web console for the Valryde public jeepney route live tracking and monitoring system.

## Current state

The Angular application shell, Admin authentication, and the User Accounts module (checklist IDs 56 and 59) are implemented against Agent A's merged API (merged in PR #2). Operator and Driver monitoring (IDs 57, 58) is implemented at account level; their fleet context waits for Agent A's directory API. Other modules follow the staged plan in the [Agent E handoff](handoffs/AGENT_E_ADMIN_WEB_HANDOFF.md); Tracking Operations stays hidden until Agent B contracts are approved.

Agent E owns MVP checklist IDs **56–67**. Stack: Angular 21 (strict TypeScript, standalone components, signals), Angular Material and CDK, custom SCSS, Vitest, and angular-eslint. MapLibre/OpenFreeMap is added with the route geometry module. Angular 21 is used because Angular 22 requires Node.js 22.22.3 or later and the current workstation runs 22.17.1.

## Development

Requires Node.js `^22.12.0 || >=24.0.0`. npm 10.9.x has a peer-resolution crash with this dependency tree; use npm 11 (`npx npm@11 install`) if `npm install` fails.

```bash
npm install
npm start          # http://localhost:4200, proxies /api to http://localhost:3000 (valryde-api)
npm run lint
npm run typecheck
npm test
npm run build
```

The client calls the same-origin `/api` base path. Production hosting must serve or reverse-proxy the Agent A API under `/api`. No secrets or environment credentials belong in this repository.

## Planned navigation

The application will use a collapsible Angular Material navigation drawer organized into:

- Dashboard
- Transit Network
- Fleet Management
- Applications & Approvals
- Tracking Operations
- Identity & Access
- System Administration

Page availability remains gated by approved product scope and backend contracts. A formal transit-stop registry, booking/transactions, payments, revenue analytics, and advanced dispatch are not part of the authorized MVP scope.

## Governance and project records

- Repository instructions: [`AGENTS.md`](AGENTS.md)
- Tool entry point: [`CLAUDE.md`](CLAUDE.md)
- Agent E handoff: [`handoffs/AGENT_E_ADMIN_WEB_HANDOFF.md`](handoffs/AGENT_E_ADMIN_WEB_HANDOFF.md)
- Shared reporting policy: [`docs/00_SHARED_AGENT_STATUS_REPORTING_POLICY.md`](docs/00_SHARED_AGENT_STATUS_REPORTING_POLICY.md)
- Canonical Agent E status: [`docs/agent-status/AGENT_E_STATUS.md`](docs/agent-status/AGENT_E_STATUS.md)

## Documentation areas

- [`docs/architecture/`](docs/architecture/) — application/module architecture
- [`docs/ui-ux/`](docs/ui-ux/) — navigation, screen inventory, components, and workflows
- [`docs/integration/`](docs/integration/) — approved API, map, tracking, and shared-contract integration
- [`docs/testing/`](docs/testing/) — acceptance and verification strategy

## Repository boundaries

`valryde-api` and `valryde-infra` are reference repositories for Agent E and must not be modified during Admin web work. Shared API, schema, Pusher, Traccar, RBAC, and geospatial contract changes require Tech Lead-controlled coordination.
