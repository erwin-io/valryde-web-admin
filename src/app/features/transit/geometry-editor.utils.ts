import { LineStringGeometry } from './transit.models';

export type Position = [number, number];

export interface GeometryValidation {
  valid: boolean;
  errors: string[];
}

const MIN_POSITIONS = 2;
export const MAX_POSITIONS = 10_000;
export const MAX_GEOJSON_BYTES = 1_048_576;

export function clonePositions(positions: readonly Position[]): Position[] {
  return positions.map(([longitude, latitude]) => [longitude, latitude]);
}

export function validatePositions(positions: readonly Position[]): GeometryValidation {
  const errors: string[] = [];
  if (positions.length < MIN_POSITIONS) errors.push('A route line needs at least two vertices.');
  if (positions.length > MAX_POSITIONS) errors.push(`A route line cannot exceed ${MAX_POSITIONS.toLocaleString()} vertices.`);

  positions.forEach((position, index) => {
    if (!Array.isArray(position) || position.length !== 2) {
      errors.push(`Vertex ${index + 1} must contain exactly [longitude, latitude].`);
      return;
    }
    const [longitude, latitude] = position;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      errors.push(`Vertex ${index + 1} must contain finite numbers.`);
      return;
    }
    if (longitude < -180 || longitude > 180) {
      errors.push(`Vertex ${index + 1} longitude must be between -180 and 180.`);
    }
    if (latitude < -90 || latitude > 90) {
      errors.push(
        `Vertex ${index + 1} latitude must be between -90 and 90. Check that coordinates use [longitude, latitude] order.`,
      );
    }
  });

  return { valid: errors.length === 0, errors };
}

export function appendPosition(positions: readonly Position[], position: Position): Position[] {
  return [...clonePositions(positions), [...position]];
}

export function insertPosition(
  positions: readonly Position[],
  index: number,
  position: Position,
): Position[] {
  const next = clonePositions(positions);
  next.splice(Math.max(0, Math.min(index, next.length)), 0, [...position]);
  return next;
}

export function movePosition(
  positions: readonly Position[],
  index: number,
  position: Position,
): Position[] {
  if (index < 0 || index >= positions.length) return clonePositions(positions);
  const next = clonePositions(positions);
  next[index] = [...position];
  return next;
}

export function removePosition(positions: readonly Position[], index: number): Position[] {
  if (index < 0 || index >= positions.length) return clonePositions(positions);
  return clonePositions(positions).filter((_, current) => current !== index);
}

export function samePositions(left: readonly Position[], right: readonly Position[]): boolean {
  return (
    left.length === right.length &&
    left.every(([longitude, latitude], index) => {
      const other = right[index];
      return other?.[0] === longitude && other[1] === latitude;
    })
  );
}

export function parseLineStringGeoJson(value: unknown): Position[] {
  const geometry = extractGeometry(value);
  if (!geometry || geometry.type !== 'LineString') {
    throw new Error('Import one GeoJSON LineString or a Feature containing one LineString.');
  }
  if (!Array.isArray(geometry.coordinates)) {
    throw new Error('The LineString coordinates must be an array.');
  }

  const positions = geometry.coordinates.map((coordinate, index): Position => {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) {
      throw new Error(`Vertex ${index + 1} must contain exactly [longitude, latitude].`);
    }
    return [coordinate[0] as number, coordinate[1] as number];
  });
  const validation = validatePositions(positions);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return positions;
}

export function asLineString(positions: readonly Position[]): LineStringGeometry {
  return { type: 'LineString', coordinates: clonePositions(positions) };
}

function extractGeometry(value: unknown): { type?: unknown; coordinates?: unknown } | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate['type'] === 'Feature') {
    const geometry = candidate['geometry'];
    return geometry && typeof geometry === 'object'
      ? (geometry as { type?: unknown; coordinates?: unknown })
      : null;
  }
  return candidate;
}
