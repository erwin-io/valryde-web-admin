import { toCsv } from './csv-export';

describe('toCsv', () => {
  const columns = [
    { heading: 'Name', value: (row: { name: string; count: number }) => row.name },
    { heading: 'Count', value: (row: { name: string; count: number }) => row.count },
  ];

  it('exports only explicit columns with CRLF rows and a UTF-8 BOM', () => {
    expect(toCsv([{ name: 'Route "A", Cebu', count: 2 }], columns)).toBe(
      '\uFEFF"Name","Count"\r\n"Route ""A"", Cebu","2"\r\n',
    );
  });

  it.each(['=2+2', '+cmd', '-1+2', '@SUM(A1)'])('neutralizes spreadsheet formula input %s', (name) => {
    expect(toCsv([{ name, count: 1 }], columns)).toContain(`"'${name}"`);
  });
});
