# Valryde Admin Design System

## Principles

Valryde Admin is an operational enterprise application. Interfaces favor clarity, density, predictable placement, and explicit state over decoration.

- One primary purpose per page.
- White and neutral surfaces with restrained Valryde teal accents.
- Standard Angular Material behavior and accessibility semantics.
- Data and actions appear only when supported by an approved contract and the current user's permissions.
- Color reinforces labels and icons but never carries meaning alone.

## Visual foundation

| Token | Use |
|---|---|
| Primary | Valryde teal `#006B67`; primary actions and active navigation |
| Primary dark | `#004D4A`; emphasis and high-contrast states |
| Accent | Amber `#C47A00`; attention that is not an error |
| Surface | White `#FFFFFF` and neutral `#F6F7F8` |
| Text | `#1B1F23`; secondary text `#5E6872` |
| Border | `#D9DEE3` |
| Error | Material red `#B3261E` |
| Success | `#2E7D32` |

Use Material typography with a 16 px body baseline, 44 px minimum pointer targets, an 8 px spacing grid, modest 4–12 px radii, and low-elevation shadows only where hierarchy requires them. Do not use gradients or glass effects.

## Layout

- Sticky 64 px desktop toolbar; 56 px on compact layouts.
- Persistent 272 px drawer on desktop, collapsible to an icon rail; overlay drawer below 960 px.
- Main content has a readable maximum width for forms/details; table and map workspaces may use the full available width.
- Page heading contains breadcrumbs, title, description, and at most one emphasized primary action.
- Dialogs are reserved for confirmation or concise operations. Multi-section work uses dedicated routes.

## Components and states

- Tables use a filter toolbar, meaningful columns, paginator when the server supports pagination, keyboard-reachable row actions, and a useful empty state.
- Forms use reactive controls, visible labels, inline validation, server-error summaries, save/cancel actions, and unsaved-change protection.
- Status badges pair text with icon/shape and meet contrast requirements.
- Loading, empty, failed, denied, stale, and blocked-by-contract states are visually distinct.
- Snackbars confirm completed actions; errors remain visible in page/dialog context until addressed.

## Responsive behavior

- Desktop: persistent drawer, full tables, side-by-side detail sections where useful.
- Tablet: overlay or compact drawer, reduced table columns, stacked forms, retained primary actions.
- Narrow screens: supported for essential review/monitoring, but geometry editing explicitly recommends a wider viewport when precision is unsafe.
