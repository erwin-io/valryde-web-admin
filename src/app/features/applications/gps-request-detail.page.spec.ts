import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { gpsRequest } from '../../../testing/application-fixtures';
import { apiError, jeepney } from '../../../testing/fixtures';
import { DeviceMapping, GpsSetupRequest } from './applications.models';
import { GpsRequestDetailPage } from './gps-request-detail.page';

const GPS = '/api/gps-setup-requests';
const JEEPS = '/api/jeepneys';
const ID = 'g1';
const BASE = `/api/admin/gps-setup-requests/${ID}`;
const unit = jeepney({ id: 'j1', plateNo: 'ABC 1234' });
const savedMapping: DeviceMapping = { id: 'm1', gpsSetupRequestId: ID, gpsDeviceId: 'd1', jeepneyId: 'j1',
  imei: '860000000000001', serialNumber: 'VAL-TEST-0001', traccarUniqueId: 'valryde-test-device-0001',
  mappedAt: '2026-11-02T10:00:00.000Z' };

describe('GpsRequestDetailPage', () => {
  let fixture: ComponentFixture<GpsRequestDetailPage>;
  let http: HttpTestingController;
  let confirm: boolean;
  let dialogOpen: ReturnType<typeof vi.fn>;

  async function open(request: Partial<GpsSetupRequest>, mapping: DeviceMapping | null = null) {
    confirm = true;
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirm) }));
    TestBed.configureTestingModule({
      imports: [GpsRequestDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GpsRequestDetailPage);
    fixture.componentRef.setInput('requestId', ID);
    await fixture.whenStable();
    flushLoad(request, mapping);
    await fixture.whenStable();
  }

  function flushLoad(request: Partial<GpsSetupRequest>, mapping: DeviceMapping | null = null) {
    http.expectOne(GPS).flush({ requests: [gpsRequest({ id: ID, jeepneyId: 'j1', ...request })] });
    http.expectOne(JEEPS).flush({ jeepneys: [unit] });
    http.expectOne(`${BASE}/device-mapping`).flush({ mapping });
  }

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const buttons = () => Array.from(el().querySelectorAll('button')).map((b) => b.textContent?.trim());
  const click = async (label: string) => {
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!.click();
    await fixture.whenStable();
  };
  const page = () =>
    fixture.componentInstance as unknown as {
      transitionForm: { patchValue(v: object): void };
      mappingForm: { setValue(v: object): void };
      verificationForm: { setValue(v: object): void };
    };
  const submitForm = async (selector: string) => {
    el().querySelector(`section[aria-labelledby="${selector}"] form`)!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  it('offers only Approve and Reject for a pending request', async () => {
    await open({ status: 'PENDING' });
    expect(buttons()).toEqual(expect.arrayContaining(['Approve installation', 'Reject request']));
    expect(buttons()).not.toContain('Schedule installation');
    expect(text()).not.toContain('Device mapping');
    expect(text()).not.toContain('Record verification');
  });

  it('approves after confirmation and re-reads the request', async () => {
    await open({ status: 'PENDING' });
    await click('Approve installation');
    const req = http.expectOne(`${BASE}/status`);
    expect(req.request.body).toEqual({ status: 'APPROVED' });
    req.flush({ request: gpsRequest({ id: ID, status: 'APPROVED' }) });
    await fixture.whenStable();
    flushLoad({ status: 'APPROVED' });
    await fixture.whenStable();
    expect(buttons()).toContain('Schedule installation');
  });

  it('requires a reason to reject and sends it trimmed', async () => {
    await open({ status: 'APPROVED' });
    await click('Reject request');
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(text()).toContain('Enter a reason');
    page().transitionForm.patchValue({ rejectedReason: '  Unit unavailable  ' });
    await click('Reject request');
    expect(dialogOpen.mock.calls[0][1].data.destructive).toBe(true);
    const req = http.expectOne(`${BASE}/status`);
    expect(req.request.body).toEqual({ status: 'REJECTED', rejectedReason: 'Unit unavailable' });
    req.flush({ request: gpsRequest({ id: ID, status: 'REJECTED' }) });
    await fixture.whenStable();
    flushLoad({ status: 'REJECTED', rejectedReason: 'Unit unavailable' });
    await fixture.whenStable();
    expect(text()).toContain('Unit unavailable');
    expect(buttons()).not.toContain('Reject request');
  });

  it('requires a date to schedule and sends it as ISO 8601', async () => {
    await open({ status: 'APPROVED' });
    await click('Schedule installation');
    expect(text()).toContain('Choose when the installation will happen.');
    page().transitionForm.patchValue({ scheduledAt: '2026-11-02T09:30' });
    await click('Schedule installation');
    const req = http.expectOne(`${BASE}/status`);
    expect(req.request.body).toEqual({ status: 'SCHEDULED', scheduledAt: new Date('2026-11-02T09:30').toISOString() });
    req.flush({ request: gpsRequest({ id: ID, status: 'SCHEDULED' }) });
    await fixture.whenStable();
    flushLoad({ status: 'SCHEDULED' });
  });

  it('sends nothing when a transition is cancelled', async () => {
    await open({ status: 'SCHEDULED' });
    confirm = false;
    await click('Mark installed');
    http.expectNone(`${BASE}/status`);
  });

  it('surfaces an invalid transition (409) and re-reads', async () => {
    await open({ status: 'SCHEDULED' });
    await click('Mark installed');
    http.expectOne(`${BASE}/status`).flush(apiError('CONFLICT', 'Invalid GPS setup transition: INSTALLED to INSTALLED', 'req-t'), { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    flushLoad({ status: 'INSTALLED', verificationStatus: 'PENDING' });
    await fixture.whenStable();
    expect(text()).toContain('Invalid GPS setup transition');
  });

  describe('device mapping', () => {
    it('validates the IMEI before calling the API', async () => {
      await open({ status: 'SCHEDULED' });
      page().mappingForm.setValue({ imei: '12345', serialNumber: 'S-1', traccarUniqueId: 'dev-1' });
      await submitForm('mapping-title');
      expect(text()).toContain('Enter 14 to 17 digits.');
      expect(dialogOpen).not.toHaveBeenCalled();
    });

    it('maps after confirmation and reconciles the saved mapping through G10', async () => {
      await open({ status: 'SCHEDULED' });
      page().mappingForm.setValue({ imei: '860000000000001', serialNumber: ' VAL-TEST-0001 ', traccarUniqueId: ' valryde-test-device-0001 ' });
      await submitForm('mapping-title');
      expect(dialogOpen.mock.calls[0][1].data.message).toContain('no operation to change or remove a mapping');
      const req = http.expectOne(`${BASE}/device-mapping`);
      expect(req.request.body).toEqual({ imei: '860000000000001', serialNumber: 'VAL-TEST-0001', traccarUniqueId: 'valryde-test-device-0001' });
      req.flush({
        mapping: { id: 'm1', gpsSetupRequestId: ID, gpsDeviceId: 'd1', jeepneyId: 'j1', imei: '860000000000001', serialNumber: 'VAL-TEST-0001', traccarUniqueId: 'valryde-test-device-0001', mappedAt: '2026-11-02T10:00:00.000Z' },
      }, { status: 201, statusText: 'Created' });
      await fixture.whenStable();
      flushLoad({ status: 'SCHEDULED' }, savedMapping);
      await fixture.whenStable();
      expect(text()).toContain('Device mapped');
      expect(text()).toContain('Saved mapping from the application API');
      expect(el().querySelector('section[aria-labelledby="mapping-title"]')).toBeNull();
    });

    it('explains a duplicate device or jeepney mapping (409 DEVICE_MAPPING_CONFLICT)', async () => {
      await open({ status: 'INSTALLED', verificationStatus: 'PENDING' });
      page().mappingForm.setValue({ imei: '860000000000001', serialNumber: 'S-1', traccarUniqueId: 'dev-1' });
      await submitForm('mapping-title');
      http.expectOne(`${BASE}/device-mapping`).flush(apiError('DEVICE_MAPPING_CONFLICT', 'Device or Traccar identity is already mapped', 'req-m'), { status: 409, statusText: 'Conflict' });
      await fixture.whenStable();
      flushLoad({ status: 'INSTALLED', verificationStatus: 'PENDING' }, savedMapping);
      await fixture.whenStable();
      expect(text()).toContain('Device mapped');
      expect(el().querySelector('section[aria-labelledby="mapping-title"]')).toBeNull();
    });
  });

  describe('verification', () => {
    it('activates only when all four checks pass', async () => {
      await open({ status: 'INSTALLED', verificationStatus: 'PENDING' });
      page().verificationForm.setValue({ powerOk: true, simOk: true, serverOk: true, gpsFixOk: true, notes: '' });
      await submitForm('verify-title');
      expect(dialogOpen.mock.calls[0][1].data.message).toContain('will be activated');
      const req = http.expectOne(`${BASE}/verification`);
      expect(req.request.body).toEqual({ powerOk: true, simOk: true, serverOk: true, gpsFixOk: true });
      req.flush({ request: gpsRequest({ id: ID, status: 'INSTALLED', verificationStatus: 'VERIFIED' }) });
      await fixture.whenStable();
      flushLoad({ status: 'INSTALLED', verificationStatus: 'VERIFIED', verifiedAt: '2026-11-02T11:00:00.000Z', verificationChecks: { powerOk: true, simOk: true, serverOk: true, gpsFixOk: true } });
      await fixture.whenStable();
      expect(el().querySelector('section[aria-labelledby="verify-title"]')).toBeNull();
      expect(text()).toContain('Pass — Valid GPS fix');
    });

    it('records a failure with notes when a check fails', async () => {
      await open({ status: 'INSTALLED', verificationStatus: 'PENDING' });
      page().verificationForm.setValue({ powerOk: true, simOk: true, serverOk: true, gpsFixOk: false, notes: 'No fix indoors' });
      await submitForm('verify-title');
      expect(dialogOpen.mock.calls[0][1].data.destructive).toBe(true);
      expect(http.expectOne(`${BASE}/verification`).request.body).toEqual({ powerOk: true, simOk: true, serverOk: true, gpsFixOk: false, notes: 'No fix indoors' });
    });

    it('shows the server explanation when no device is mapped (409 GPS_NOT_INSTALLED)', async () => {
      await open({ status: 'INSTALLED', verificationStatus: 'PENDING' });
      page().verificationForm.setValue({ powerOk: true, simOk: true, serverOk: true, gpsFixOk: true, notes: '' });
      await submitForm('verify-title');
      http.expectOne(`${BASE}/verification`).flush(apiError('GPS_NOT_INSTALLED', 'A device mapping is required before verification'), { status: 409, statusText: 'Conflict' });
      await fixture.whenStable();
      expect(text()).toContain('Verification was not recorded. A device mapping is required before verification');
    });
  });

  it('shows no actions for a rejected request and never claims live device status', async () => {
    await open({ status: 'REJECTED', rejectedReason: 'Duplicate request' });
    expect(text()).toContain('Duplicate request');
    expect(el().querySelectorAll('form')).toHaveLength(0);
    expect(el().querySelector('.contract-gate')?.textContent).toContain('Live device connectivity');
    const terms = Array.from(el().querySelectorAll('dt')).map((d) => d.textContent ?? '').join(' ');
    expect(terms).not.toMatch(/online|last position|speed|battery/i);
  });

  it('reads an existing mapping on a fresh visit and never offers duplicate mapping', async () => {
    await open({ status: 'INSTALLED', verificationStatus: 'VERIFIED' }, savedMapping);
    expect(text()).toContain(savedMapping.serialNumber);
    expect(text()).toContain('Saved mapping from the application API');
    expect(el().querySelector('section[aria-labelledby="mapping-title"]')).toBeNull();
  });

  it('does not send duplicate writes and restores actions after cancellation', async () => {
    await open({ status: 'PENDING' });
    await click('Approve installation');
    (fixture.componentInstance as unknown as { transition(s: string): void }).transition('APPROVED');
    const req = http.expectOne(`${BASE}/status`);
    req.flush(apiError('FORBIDDEN', 'Denied', 'req-permission'), { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(text()).toContain('req-permission');
    confirm = false;
    await click('Approve installation');
    http.expectNone(`${BASE}/status`);
    expect(Array.from(el().querySelectorAll('button')).find(b => b.textContent?.trim() === 'Approve installation')!.disabled).toBe(false);
  });

  it.each([403, 500])('fails closed when the mapping read returns %s and can retry', async status => {
    await open({ status: 'SCHEDULED' });
    (fixture.componentInstance as unknown as { load(): void }).load();
    http.expectOne(GPS).flush({ requests: [gpsRequest({ id: ID, jeepneyId: 'j1', status: 'SCHEDULED' })] });
    http.expectOne(JEEPS).flush({ jeepneys: [unit] });
    http.expectOne(`${BASE}/device-mapping`).flush(apiError('FORBIDDEN', 'Mapping read failed', 'req-read'), { status, statusText: 'Failure' });
    await fixture.whenStable();
    expect(el().querySelectorAll('form')).toHaveLength(0);
    expect(text()).toContain(status === 403 ? 'You do not have permission' : 'could not be loaded');
    (fixture.componentInstance as unknown as { load(): void }).load();
    flushLoad({ status: 'SCHEDULED' }, savedMapping);
    await fixture.whenStable();
    expect(text()).toContain('Device mapped');
  });

  it('shows not-found and permission states', async () => {
    confirm = true;
    TestBed.configureTestingModule({
      imports: [GpsRequestDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GpsRequestDetailPage);
    fixture.componentRef.setInput('requestId', 'missing');
    await fixture.whenStable();
    http.expectOne(GPS).flush({ requests: [] });
    http.expectOne(JEEPS).flush({ jeepneys: [] });
    await fixture.whenStable();
    expect(text()).toContain('Record not found');
    (fixture.componentInstance as unknown as { load(): void }).load();
    http.expectOne(JEEPS).flush({ jeepneys: [] });
    http.expectOne(GPS).flush(apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(text()).toContain('You do not have permission to view this');
  });
});
