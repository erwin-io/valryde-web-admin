import {
  appendPosition,
  asLineString,
  insertPosition,
  movePosition,
  parseLineStringGeoJson,
  removePosition,
  samePositions,
  validatePositions,
} from './geometry-editor.utils';

const line = (): [number, number][] => [
  [123.86, 10.26],
  [123.88, 10.28],
  [123.9, 10.3],
];

describe('geometry editor transformations', () => {
  it('adds, inserts, moves, and removes vertices without mutating the source', () => {
    const source = line();
    expect(appendPosition(source, [123.91, 10.31])).toEqual([...source, [123.91, 10.31]]);
    expect(insertPosition(source, 1, [123.87, 10.27])).toEqual([
      source[0],
      [123.87, 10.27],
      source[1],
      source[2],
    ]);
    expect(movePosition(source, 1, [124, 11])).toEqual([source[0], [124, 11], source[2]]);
    expect(removePosition(source, 1)).toEqual([source[0], source[2]]);
    expect(source).toEqual(line());
  });

  it('compares coordinates deterministically and creates a detached LineString', () => {
    expect(samePositions(line(), line())).toBe(true);
    expect(samePositions(line(), movePosition(line(), 0, [123, 10]))).toBe(false);
    const geometry = asLineString(line());
    geometry.coordinates[0][0] = 0;
    expect(line()[0][0]).toBe(123.86);
  });
});

describe('geometry validation and import', () => {
  it('accepts a bounded valid LineString geometry or Feature', () => {
    expect(parseLineStringGeoJson({ type: 'LineString', coordinates: line() })).toEqual(line());
    expect(
      parseLineStringGeoJson({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line() } }),
    ).toEqual(line());
  });

  it('rejects collections, polygons, too few points, extra ordinates, and non-finite values', () => {
    expect(() => parseLineStringGeoJson({ type: 'FeatureCollection', features: [] })).toThrow('one GeoJSON LineString');
    expect(() => parseLineStringGeoJson({ type: 'Polygon', coordinates: [] })).toThrow('one GeoJSON LineString');
    expect(() => parseLineStringGeoJson({ type: 'LineString', coordinates: [[123, 10]] })).toThrow('at least two');
    expect(() => parseLineStringGeoJson({ type: 'LineString', coordinates: [[123, 10, 4], [124, 11]] })).toThrow(
      'exactly [longitude, latitude]',
    );
    expect(validatePositions([[Number.NaN, 10], [124, 11]]).errors).toContain(
      'Vertex 1 must contain finite numbers.',
    );
  });

  it('reports longitude and latitude ranges with coordinate-order guidance', () => {
    const result = validatePositions([
      [181, 10],
      [10, 123],
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Vertex 1 longitude must be between -180 and 180.');
    expect(result.errors[1]).toContain('[longitude, latitude] order');
  });
});
