import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanDeactivateFn } from '@angular/router';
import { map } from 'rxjs';

import { ConfirmDialog, ConfirmDialogData } from '../ui/confirm-dialog';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a form with unsaved edits (docs/ui-ux/DESIGN_SYSTEM.md). */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) return true;
  return inject(MatDialog)
    .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: {
        title: 'Discard unsaved changes?',
        message: 'Your edits on this page have not been saved and will be lost.',
        confirmLabel: 'Discard changes',
        destructive: true,
      },
    })
    .afterClosed()
    .pipe(map((discard) => discard === true));
};
