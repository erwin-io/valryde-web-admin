# Independent UI Closure Browser Evidence

**Date:** 2026-10-22 (Asia/Manila)

**Scope:** IDs 56–64 and bounded ID 67

**Environment:** Angular development server on localhost plus a temporary synthetic Node API fixture. The fixture was removed after the run; no real API, credentials, private data, Traccar service, or backend write was used.

## Viewports checked

| Viewport | Geometry editor | Transit snapshot |
|---|---|---|
| 1440 × 900 | Two-column editor, visible route line, MapLibre controls, saved/draft copy, endpoint-aware coordinate controls | Desktop behavior covered by the same responsive table/layout plus automated tests |
| 768 × 1024 | Drawer collapsed to overlay control; editor reflowed without horizontal document overflow | Four summary values, filter row, five-column table, paginator, and scope notice visible |
| 375 × 812 | Single-column map then vertex controls; route line and navigation controls visible; all coordinate/nudge/remove/import controls reachable below the map | Summary cards reflowed to two columns; filters stacked; optional endpoint/geometry columns hidden; route, direction, and status remained available |

Measured `document.body.scrollWidth === document.body.clientWidth` at the tablet viewport. Mobile screenshots were inspected at both the map and the lower vertex-control section.

## Interaction evidence

- Synthetic Admin sign-in reached the guarded dashboard and displayed dashboard queue/task navigation.
- Direct geometry navigation loaded route `10F`, direction `Northbound`, three vertices, origin/destination context, and the same-origin MapLibre worker.
- “Move vertex north” changed the draft latitude from `10.26` to `10.2601`, enabled Save/Undo/Reset, and switched the copy to an unsaved colored draft.
- Undo restored `10.26`, disabled Save/Reset, enabled Redo, and restored the “draft matches” message.
- Transit snapshot showed 2 routes, 1 direction, 1 active direction, 2 filtered rows, pagination, print, CSV action, and the explicit current-snapshot limitation.
- No console error was emitted after the same-origin MapLibre worker asset fix. Earlier failed worker loads during diagnosis are not acceptance evidence and were resolved before this run.

This is synthetic browser evidence, not real authenticated backend or hardware evidence.
