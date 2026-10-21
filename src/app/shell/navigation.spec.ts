import { routes } from '../app.routes';
import { NAVIGATION } from './navigation';

describe('NAVIGATION', () => {
  const shellPaths = routes.find((r) => r.path === '')?.children?.map((r) => `/${r.path}`) ?? [];

  it('links only to implemented shell routes', () => {
    for (const item of NAVIGATION.flatMap((g) => g.items)) {
      expect(shellPaths).toContain(item.route);
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
