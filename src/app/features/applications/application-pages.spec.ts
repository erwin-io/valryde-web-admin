import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { gpsRequest, vehicleApplication } from '../../../testing/application-fixtures';
import { apiError, jeepney, user } from '../../../testing/fixtures';
import { ApplicationListPage } from './application-list.page';
import { ApplicationReviewPage } from './application-review.page';
import { GpsRequestListPage } from './gps-request-list.page';

const APPS = '/api/vehicle-applications';
const GPS = '/api/gps-setup-requests';
const JEEPS = '/api/jeepneys';
const USERS = '/api/admin/users/';

const unit = jeepney({ id: 'j1', plateNo: 'ABC 1234' });
const operator = user({ id: 'op-user', displayName: 'Omar Operator', email: 'omar@example.test', roles: ['OPERATOR'] });
const pending = vehicleApplication({ id: 'a1', jeepneyId: 'j1' });
const approved = vehicleApplication({ id: 'a2', jeepneyId: 'j2', status: 'APPROVED', reviewedAt: '2026-10-05T00:00:00.000Z' });

describe('vehicle application and GPS queues', () => {
  let http: HttpTestingController;
  let confirm: boolean;
  let dialogOpen: ReturnType<typeof vi.fn>;

  function create<T>(component: Type<T>): ComponentFixture<T> {
    confirm = true;
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirm) }));
    TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(component);
  }

  const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';
  const rows = (f: ComponentFixture<unknown>) =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row')).map((r) => r.textContent ?? '');

  afterEach(() => http.verify());

  describe('ApplicationListPage', () => {
    it('joins plates, links to review, and labels missing jeepneys', async () => {
      const f = create(ApplicationListPage);
      await f.whenStable();
      http.expectOne(APPS).flush({ applications: [pending, approved] });
      http.expectOne(JEEPS).flush({ jeepneys: [unit] });
      await f.whenStable();
      expect(rows(f)[0]).toContain('ABC 1234');
      expect(rows(f)[0]).toContain('Pending review');
      expect(rows(f)[1]).toContain('Unknown jeepney');
      expect((f.nativeElement as HTMLElement).querySelector('tr.mat-mdc-row a')?.getAttribute('href')).toBe('/applications/vehicles/a1');
    });

    it('applies a dashboard status preset', async () => {
      const f = create(ApplicationListPage);
      f.componentRef.setInput('filter', 'PENDING');
      await f.whenStable();
      http.expectOne(APPS).flush({ applications: [pending, approved] });
      http.expectOne(JEEPS).flush({ jeepneys: [unit] });
      await f.whenStable();
      expect(rows(f)).toHaveLength(1);
    });

    it('shows denied, error with retry, and empty states', async () => {
      const f = create(ApplicationListPage);
      await f.whenStable();
      http.expectOne(JEEPS).flush({ jeepneys: [] });
      http.expectOne(APPS).flush(apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'Forbidden' });
      await f.whenStable();
      expect(text(f)).toContain('You do not have permission to view this');
      (f.componentInstance as unknown as { load(): void }).load();
      http.expectOne(JEEPS).flush({ jeepneys: [] });
      http.expectOne(APPS).flush(apiError('INTERNAL_ERROR', 'Boom', 'req-a'), { status: 500, statusText: 'Error' });
      await f.whenStable();
      expect(text(f)).toContain('req-a');
      (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('app-page-state button')!.click();
      http.expectOne(APPS).flush({ applications: [] });
      http.expectOne(JEEPS).flush({ jeepneys: [] });
      await f.whenStable();
      expect(text(f)).toContain('No vehicle applications yet');
    });
  });

  describe('ApplicationReviewPage', () => {
    async function review(app = pending, requests = [] as object[]) {
      const f = create(ApplicationReviewPage);
      f.componentRef.setInput('applicationId', app.id);
      await f.whenStable();
      flushReview(app, requests);
      await f.whenStable();
      return f;
    }
    function flushReview(app = pending, requests = [] as object[]) {
      http.expectOne(APPS).flush({ applications: [app, approved] });
      http.expectOne(JEEPS).flush({ jeepneys: [unit] });
      http.expectOne(USERS).flush({ users: [operator] });
      http.expectOne(GPS).flush({ requests });
    }
    const form = (f: ComponentFixture<ApplicationReviewPage>) =>
      (f.componentInstance as unknown as { form: { setValue(v: object): void } }).form;
    const submit = async (f: ComponentFixture<unknown>) => {
      (f.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
      await f.whenStable();
    };

    it('shows joined applicant and jeepney links with the review form for a pending application', async () => {
      const f = await review();
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('a[href="/fleet/jeepneys/j1"]')?.textContent).toContain('ABC 1234');
      expect(el.querySelector('a[href="/identity/users/op-user"]')?.textContent).toContain('Omar Operator');
      expect(el.querySelector('form')).not.toBeNull();
      expect(text(f)).not.toMatch(/request correction/i);
    });

    it('requires a decision before submitting', async () => {
      const f = await review();
      await submit(f);
      expect(text(f)).toContain('Choose Approve or Reject.');
      expect(dialogOpen).not.toHaveBeenCalled();
    });

    it('approves after confirmation without empty notes, then re-reads', async () => {
      const f = await review();
      form(f).setValue({ decision: 'APPROVED', reviewNotes: '  ' });
      await submit(f);
      const req = http.expectOne(`/api/admin/vehicle-applications/a1/review`);
      expect(req.request.body).toEqual({ decision: 'APPROVED' });
      req.flush({ application: { ...pending, status: 'APPROVED' } });
      await f.whenStable();
      flushReview({ ...pending, status: 'APPROVED' });
      await f.whenStable();
      expect(text(f)).toContain('Approved');
      expect((f.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    });

    it('rejects with notes behind a destructive confirmation, and sends nothing when cancelled', async () => {
      const f = await review();
      form(f).setValue({ decision: 'REJECTED', reviewNotes: 'Plate mismatch' });
      confirm = false;
      await submit(f);
      expect(dialogOpen.mock.calls[0][1].data.destructive).toBe(true);
      http.expectNone(`/api/admin/vehicle-applications/a1/review`);
      confirm = true;
      await submit(f);
      expect(http.expectOne(`/api/admin/vehicle-applications/a1/review`).request.body).toEqual({
        decision: 'REJECTED',
        reviewNotes: 'Plate mismatch',
      });
    });

    it('re-reads after a 409 so a concurrent decision is shown', async () => {
      const f = await review();
      form(f).setValue({ decision: 'APPROVED', reviewNotes: '' });
      await submit(f);
      http
        .expectOne(`/api/admin/vehicle-applications/a1/review`)
        .flush(apiError('CONFLICT', 'Only pending applications can be reviewed', 'req-409'), { status: 409, statusText: 'Conflict' });
      await f.whenStable();
      expect(text(f)).toContain('Only pending applications can be reviewed');
      flushReview({ ...pending, status: 'REJECTED', reviewedAt: '2026-10-06T00:00:00.000Z' });
      await f.whenStable();
      expect(text(f)).toContain('Rejected');
    });

    it('shows a server RBAC rejection', async () => {
      const f = await review();
      form(f).setValue({ decision: 'APPROVED', reviewNotes: '' });
      await submit(f);
      http
        .expectOne(`/api/admin/vehicle-applications/a1/review`)
        .flush(apiError('FORBIDDEN', 'This role is not permitted to perform the operation'), { status: 403, statusText: 'Forbidden' });
      await f.whenStable();
      expect(text(f)).toContain('The review was not saved. This role is not permitted');
    });

    it('links an existing GPS installation and hides the form for decided applications', async () => {
      const f = await review(approved, [gpsRequest({ id: 'g1', vehicleApplicationId: 'a2' })]);
      expect((f.nativeElement as HTMLElement).querySelector('a[href="/applications/gps/g1"]')).not.toBeNull();
      expect((f.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    });
  });

  describe('GpsRequestListPage', () => {
    it('presets the needs-action filter and shows verification status', async () => {
      const f = create(GpsRequestListPage);
      f.componentRef.setInput('filter', 'ACTION');
      await f.whenStable();
      http.expectOne(GPS).flush({
        requests: [
          gpsRequest({ id: 'g1', jeepneyId: 'j1', status: 'INSTALLED', verificationStatus: 'FAILED' }),
          gpsRequest({ id: 'g2', jeepneyId: 'j1', status: 'INSTALLED', verificationStatus: 'VERIFIED' }),
          gpsRequest({ id: 'g3', jeepneyId: 'j1', status: 'REJECTED' }),
        ],
      });
      http.expectOne(JEEPS).flush({ jeepneys: [unit] });
      await f.whenStable();
      expect(rows(f)).toHaveLength(1);
      expect(rows(f)[0]).toContain('Failed');
    });
  });
});
