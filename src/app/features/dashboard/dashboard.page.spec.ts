import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { gpsRequest, vehicleApplication } from '../../../testing/application-fixtures';
import { user } from '../../../testing/fixtures';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: signal(user()) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPage);
  });

  afterEach(() => http.verify());

  const items = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('section[aria-labelledby="attention-title"] a')).map(
      (a) => ({ text: a.getAttribute('aria-label'), href: a.getAttribute('href') }),
    );

  it('counts pending work from the application and GPS lists and links to filtered queues', async () => {
    await fixture.whenStable();
    http.expectOne('/api/vehicle-applications').flush({
      applications: [vehicleApplication(), vehicleApplication({ id: 'a2' }), vehicleApplication({ id: 'a3', status: 'APPROVED' })],
    });
    http.expectOne('/api/gps-setup-requests').flush({
      requests: [
        gpsRequest({ id: 'g1', status: 'PENDING' }),
        gpsRequest({ id: 'g2', status: 'APPROVED' }),
        gpsRequest({ id: 'g3', status: 'SCHEDULED' }),
        gpsRequest({ id: 'g4', status: 'INSTALLED', verificationStatus: 'FAILED' }),
        gpsRequest({ id: 'g5', status: 'INSTALLED', verificationStatus: 'VERIFIED' }),
        gpsRequest({ id: 'g6', status: 'REJECTED' }),
      ],
    });
    await fixture.whenStable();
    expect(items()).toEqual([
      { text: '2 Vehicle applications awaiting review', href: '/applications/vehicles?filter=PENDING' },
      { text: '1 GPS requests awaiting approval', href: '/applications/gps?filter=PENDING' },
      { text: '1 GPS installations to schedule', href: '/applications/gps?filter=APPROVED' },
      { text: '2 Installations awaiting completion or verification', href: '/applications/gps?filter=ACTION' },
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toMatch(/online|revenue|ridership|passengers/i);
  });

  it('shows a retryable message when counts cannot be loaded', async () => {
    await fixture.whenStable();
    http.expectOne('/api/gps-setup-requests').flush({ requests: [] });
    http.expectOne('/api/vehicle-applications').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pending work could not be loaded.');
  });
});
