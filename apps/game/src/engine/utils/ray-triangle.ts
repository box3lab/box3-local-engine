import { vec3 } from 'gl-matrix';
import { toVec3 } from './vec3';

// Möller-Trumbore algorithm
export function rayTriangle (tri:ArrayLike<number>[], ray:{origin:ArrayLike<number>, dir:ArrayLike<number>}) {
  const EPSILON = 0.000001;
  const a = toVec3(tri[0]);
  const b = toVec3(tri[1]);
  const c = toVec3(tri[2]);
  const origin = toVec3(ray.origin);
  const direction = toVec3(ray.dir);
  const edge1 = vec3.create();
  const edge2 = vec3.create();
  const tvec = vec3.create();
  const pvec = vec3.create();
  const qvec = vec3.create();

  vec3.subtract(edge1, b, a);
  vec3.subtract(edge2, c, a);

  vec3.cross(pvec, direction, edge2);

  const det = vec3.dot(edge1, pvec);
  if (det < EPSILON) {
    return null;
  }
  vec3.subtract(tvec, origin, a);
  const u = vec3.dot(tvec, pvec);
  if (u < 0 || u > det) {
    return null;
  }
  vec3.cross(qvec, tvec, edge1);
  const v = vec3.dot(direction, qvec);
  if (v < 0 || u + v > det) {
    return null;
  }

  const t = vec3.dot(edge2, qvec) / det;

  return t;
}