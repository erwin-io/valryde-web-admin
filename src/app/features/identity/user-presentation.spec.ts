import { user } from '../../../testing/fixtures';
import { EMPTY_FILTERS, filterUsers, roleList } from './user-presentation';

describe('filterUsers', () => {
  const users = [
    user({ id: 'a', displayName: 'Ada Admin', email: 'ada@example.test' }),
    user({ id: 'b', displayName: 'Omar Operator', email: 'omar@example.test', roles: ['OPERATOR'] }),
    user({ id: 'c', displayName: 'Dina Driver', email: 'dina@example.test', roles: ['DRIVER'], status: 'DISABLED' }),
  ];
  const ids = (filters: Partial<typeof EMPTY_FILTERS>) =>
    filterUsers(users, { ...EMPTY_FILTERS, ...filters }).map((u) => u.id);

  it('returns everything without filters', () => expect(ids({})).toEqual(['a', 'b', 'c']));
  it('searches name and email, case-insensitively', () => {
    expect(ids({ search: '  OMAR ' })).toEqual(['b']);
    expect(ids({ search: 'dina@' })).toEqual(['c']);
  });
  it('filters by role', () => expect(ids({ role: 'DRIVER' })).toEqual(['c']));
  it('filters by status', () => expect(ids({ status: 'ACTIVE' })).toEqual(['a', 'b']));
  it('combines filters', () => expect(ids({ role: 'OPERATOR', status: 'DISABLED' })).toEqual([]));
});

describe('roleList', () => {
  it('labels roles', () => expect(roleList(user({ roles: ['OPERATOR', 'DRIVER'] }))).toBe('Operator, Driver'));
  it('labels accounts without roles', () => expect(roleList(user({ roles: [] }))).toBe('No role'));
});
