# Evidence — Admin shell and User Accounts (IDs 56, 59)

Captured 2026-10-21 from `ng serve` (development build) in the Claude desktop browser pane.

**All data shown is synthetic.** The API was a throwaway local Node stub on `127.0.0.1:3000` that mimics the Agent A response shapes for `/api/auth/login|refresh|logout`, `GET /api/admin/users/`, and `PATCH /api/admin/users/{id}/status`. The stub is not committed. These screenshots are **not** evidence of real backend authentication, authorization, or status-update integration.

| File | Viewport | Shows |
|---|---|---|
| `01-sign-in-validation.png` | 1024 px | Session-ended notice, inline validation after an invalid submit |
| `02-dashboard.jpg` | 1024 px | Shell, grouped drawer, dashboard task shortcuts, no invented metrics |
| `03-user-accounts-list.png` | 1024 px | Filters, role text, icon + text status badges, row actions |
| `04-disable-confirmation.png` | 1024 px | Disable confirmation naming target and consequence |
| `05-user-detail-mobile.jpg` | 375 px | Composed detail page, breadcrumbs, enable action, overlay drawer closed |
