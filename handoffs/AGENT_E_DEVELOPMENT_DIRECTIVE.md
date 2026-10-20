# VALRYDE — Agent E Development Directive and Tech Lead Release (record)

Recorded 2026-10-21 by the execution agent from the owner-supplied text so future sessions do not depend on chat history. This is a verbatim-substance record, not an independent rewrite; the owner/Tech Lead text remains authoritative. Where it conflicts with an approved backend contract (for example Stops or request-correction), the API contract matrix governs and the gap is reported, not invented.

## Tech Lead release

**Decision: DEVELOPMENT AUTHORIZED.** Workspace `C:\Development\valryde\valryde-web-admin`.

1. Produce the complete Admin Web UX contract and navigation structure (reported `UX_CONTRACT_READY` 2026-10-21 03:20 +08:00).
2. Use Angular + Angular Material + Angular CDK.
3. Implement a conventional enterprise dashboard shell.
4. Organize the drawer into coherent business-domain groups: Dashboard, Transit Network, Fleet Management, Applications & Approvals, Tracking Operations, Identity & Access, System Administration.
5. Define single-responsibility list, detail, create/edit, approval and map-editor screens.
6. Implement reusable Material components, responsive layouts and route guards.
7. Use only verified Agent A API contracts.
8. Keep Tracking Operations behind Agent B integration gates.

Only expose actual MVP features in production navigation. No booking, payment, revenue or advanced analytics without approval. Restrained branding; no AI-style gradients or decorative dashboards. Preserve Git state, documentation and policy synchronization. Do not self-merge.

## Directive summary (Checklist IDs 56–67)

- **Mission:** conventional enterprise Angular Material admin console: easy to learn, single-responsibility pages, predictable navigation, efficient tables/filters, consistent create/view/edit, actionable errors, Admin-controlled canonical transit configuration.
- **Technology:** strict TypeScript Angular, Material, CDK, Router, typed API services, Reactive Forms, reusable form/table utilities, guards and permission-aware navigation, MapLibre with configurable OpenFreeMap-compatible styles, responsive desktop/tablet. No competing UI libraries.
- **Visual design:** sticky toolbar; persistent collapsible drawer on desktop, overlay on narrow screens; page title/description; breadcrumbs; contextual actions; searchable tables; dedicated detail pages; dialogs only for concise operations. Prohibited: gradients, glassmorphism, oversized cards, decorative charts, random KPIs, deep drawer nesting, overcrowded forms, miscellaneous pages.
- **Navigation groups:** A Dashboard (actionable pending items, verified summaries, shortcuts; real data only); B Transit Network (routes/directions, details, stops, geometry editor, assignment context); C Fleet Management (vehicles, groups, operators, drivers, assignments, contextual links); D Applications & Approvals (GPS applications, review queue, details, only approved transitions, installation/verification status); E Tracking Operations (Agent B-dependent; typed interfaces now, no live claim); F Identity & Access (user, commuter, admin accounts, role info; only Agent A-authorized lifecycle actions); G System Administration (configuration, integration status, audit where supported; never expose secrets); H Future modules (booking, payments, revenue, ridership, scorecards, dispatch, fare collection, optimization, alerts) documented only.
- **Page patterns:** list, detail, create/edit (unsaved-change protection), approval, map editor (draft state, discard warning). No multi-purpose pages.
- **Relationships:** Operator → groups → vehicles → drivers; Vehicle → driver → effective route → GPS status; Route → direction → geometry → stops → assignments; GPS application → applicant → vehicle → review → verification; Tracking map → vehicle → tracking details. Contextual links, backend authoritative.
- **Workflows:** W-01 to W-11 as specified in `docs/ui-ux/ADMIN_WORKFLOWS.md`.
- **API rules:** consume Agent A merged API exactly; invent no endpoints, role actions, DTOs, tracking endpoints, analytics or transitions; mark missing contracts blocked; isolated, labeled mocks only; never modify backend.
- **Map rules:** route display, direction geometry, line editing, stop markers (only when a stop contract exists), validation, save/error/recovery; never silently modify routes used by active vehicles; use the effective-route resolver.
- **Dashboard rules:** what needs attention, current authorized status, where to go next; no invented ridership/revenue/booking/utilization metrics.
- **Shared components:** shell/drawer, page heading, filter toolbar, paginated table, status badge, record details, confirm dialog, error/empty/loading, form messages, permission denied, breadcrumbs, map panel, related links; no over-universal components.
- **Stages:** 1 inspection; 2 navigation/inventory; 3 design system and shell; 4 auth and access-controlled navigation; 5 route and fleet modules; 6 applications and approvals; 7 available API integration; 8 Agent B tracking views; 9 tests, responsive checks, e2e, review. Proceed autonomously; do not wait for GPS hardware.
- **Acceptance:** understandable navigation, single-purpose pages, correct permissions, reliable search/filter/pagination, validation/error handling, responsive layout, map interactions, real backend integration, loading/empty/error states, related-record navigation, automated tests and build checks.
- **Governance:** issue → branch → implementation → verification → PR → Tech Lead review → owner-authorized merge. No self-merge. Update status after meaningful changes.
- **Authorization:** proceed autonomously with Admin web work and API integration. Do not modify backend contracts, Traccar infrastructure or production databases. New business modules, security changes or undefined workflow transitions require approval.
