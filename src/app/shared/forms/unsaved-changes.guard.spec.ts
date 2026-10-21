import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';

import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  function run(dirty: boolean, discard: boolean) {
    const open = vi.fn(() => ({ afterClosed: () => of(discard) }));
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: { open } }] });
    const result = TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        { hasUnsavedChanges: () => dirty },
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    return { result, open };
  }

  it('lets a clean form leave without asking', () => {
    const { result, open } = run(false, false);
    expect(result).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('asks before discarding and respects the answer', async () => {
    expect(await firstValueFrom(run(true, false).result as Observable<boolean>)).toBe(false);
    TestBed.resetTestingModule();
    expect(await firstValueFrom(run(true, true).result as Observable<boolean>)).toBe(true);
  });
});
