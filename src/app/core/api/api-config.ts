import { InjectionToken } from '@angular/core';

/** Base path of the Agent A API: same-origin `/api` everywhere; development uses proxy.conf.json. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
