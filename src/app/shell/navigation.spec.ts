import { Routes } from '@angular/router';

import { routes } from '../app.routes';
import { NAVIGATION } from './navigation';

describe('NAVIGATION', () => {
  const shellRoutes = routes.find((r) => r.path === '')?.children ?? [];

  it('links only to implemented shell routes', async () => {
    for (const item of NAVIGATION.flatMap((g) => g.items)) {
      const direct = shellRoutes.some((r) => `/${r.path}` === item.route);
      const lazy = shellRoutes.find((r) => r.loadChildren && item.route.startsWith(`/${r.path}/`));
      const children = lazy ? ((await (lazy.loadChildren as () => Promise<Routes>)()) ?? []) : [];
      const viaLazy = !!lazy && children.some((c) => `/${lazy.path}/${c.path}` === item.route);
      expect(direct || viaLazy, item.route).toBe(true);
    }
  });

  it('exposes no Agent B tracking or out-of-scope modules', () => {
    const labels = NAVIGATION.map((g) => g.label);
    expect(labels).not.toContain('Tracking Operations');
    expect(NAVIGATION.flatMap((g) => g.items).map((i) => i.route).join()).not.toMatch(
      /tracking|booking|payment|revenue|stops/,
    );
  });
});
