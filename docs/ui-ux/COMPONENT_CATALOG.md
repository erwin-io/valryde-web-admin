# Component Catalog

| Component | Responsibility | Notes |
|---|---|---|
| `AppShell` | Toolbar, responsive drawer, content outlet | Admin-only guarded parent route |
| `PageHeader` | Breadcrumbs, title, description, primary action | No decorative KPI content |
| `FilterToolbar` | Search and feature-specific filters | Emits typed filter state |
| `DataTable` convention | Sortable rows and responsive columns | Feature tables keep their own typed columns/actions |
| `StatusBadge` | Text/icon status semantics | Central tone mapping; never color-only |
| `RecordDetails` convention | Definition-list record presentation | Feature-specific content projection |
| `ConfirmDialog` | Concise destructive/state-change confirmation | Clear target and consequence |
| `LoadingState` | Busy announcement and skeleton/progress | Avoid layout shift |
| `EmptyState` | No data or no filter matches | Distinguish the two cases |
| `ErrorState` | Actionable failure and retry | Shows request ID when safe |
| `PermissionDenied` | 403 and guard-denied explanation | No sensitive detail |
| `FormErrorSummary` | Server and cross-field errors | Links/focuses invalid controls |
| `Breadcrumbs` | Hierarchical context | Uses configured route metadata |
| `RelatedRecordLink` | Cross-domain navigation | Does not duplicate related CRUD |
| `MapPanel` | Map lifecycle and non-secret style config | Feature editor owns geometry rules |
| `GeometryEditorPage` | One-direction LineString draft, MapLibre preview, accessible vertex controls, import and exact PATCH | No external basemap, corridor, stops, geofence, assignment impact, or Agent B logic |
| `ReportSummary` | Accessible definition-list summary for contract-backed report rows | Simple values only; no decorative chart |
| `CsvExportService` | Explicit-column client CSV with spreadsheet-formula neutralization | Callers must pass only authorized, already-loaded rows |

Utilities include typed API envelopes/errors, loading-state helpers, permission predicates, URL-safe return navigation, and table filter normalization. Reuse stops where it would obscure domain rules.
