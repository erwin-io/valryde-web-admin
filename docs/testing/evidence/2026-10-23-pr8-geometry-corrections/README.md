# Evidence — PR #8 Agent G corrections E8-01 and E8-02

**Date:** 2026-10-23 (Asia/Manila). **Executor:** Claude (takeover round 2, `VALRYDE-CLAUDE-E-TAKEOVER-ROUND2-001`).
**Environment:** `ng serve` on localhost with a temporary synthetic Node stub on port 3100 (not committed). The stub's geometry PATCH was delayed 3 s to observe the save lock. Proxy target confirmed (`/api/health` → stub 404, not the real API). No real API, credentials, private data, Traccar service or backend write was used.

| File | Viewport | Shows |
|---|---|---|
| `01-geometry-canvas-1440.png` | 1440×900 | Blank geometry-canvas notice beside the editor; coordinate fields and GeoJSON import retained |
| `02-geometry-canvas-768.jpg` | 768×1024 | Same at tablet width |
| `03-geometry-canvas-375.jpg` | 375×812 | Same at phone width |

DOM-verified browser checks:

- **E8-01 save lock (1440×900):** nudge → Save → active-route confirmation (unchanged copy) → during the 3 s request the header shows "Saving…", nudge/undo/import are disabled, the canvas is locked, the status line reads "Saving… editing is paused until the save finishes", and a forced nudge click leaves the coordinates unchanged. After the response the snackbar reads "Canonical route line saved.", editing re-enables and the saved draft is kept.
- **Responsive:** geometry editor and transit snapshot have no horizontal page overflow at 1440×900, 768×1024 and 375×812; the canvas notice, both coordinate inputs and the import input are present at every width.
- Console: one 404, from the deliberate `/api/health` proxy probe against the stub; no application errors.
