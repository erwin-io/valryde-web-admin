# Valryde Admin

Administrative web console for the Valryde public jeepney route live tracking and monitoring system.

## Current state

Repository governance and documentation structure are bootstrapped. Application source has not yet been scaffolded; feature implementation waits for the full Agent E development directive.

Agent E owns MVP checklist IDs **56–67**. The planned baseline is Angular, TypeScript, Angular Material, Angular CDK, custom SCSS, and MapLibre/OpenFreeMap.

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
