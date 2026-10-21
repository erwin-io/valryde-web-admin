import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps internal paths', () => {
    expect(safeReturnUrl('/identity/users?role=ADMIN')).toBe('/identity/users?role=ADMIN');
  });

  it.each([null, '', 'https://evil.test', '//evil.test', '/\\evil.test', 'identity', '/sign-in'])(
    'falls back for %s',
    (value) => {
      expect(safeReturnUrl(value)).toBe('/dashboard');
    },
  );
});
