import { vec3 } from 'gl-matrix';
import { toVec3 } from './vec3';

export type TestCone = {
  cosa:number,    //he half angle between the axis and the surface
  axis:vec3,      //axis as a unit vector ^V in the direction of increasing radius
  height:number,
  tipPos:vec3,
};

export function intersectCone(cone:TestCone, ray:{origin:ArrayLike<number>, dir:ArrayLike<number>}) {
  const origin = toVec3(ray.origin);
  const direction = toVec3(ray.dir);
  const co = vec3.sub(vec3.create(), origin, cone.tipPos);
  const rDir_dot_axis = vec3.dot(direction, cone.axis);
  const co_dot_axis = vec3.dot(co, cone.axis);
  const cosA2 = cone.cosa * cone.cosa;
  const a = rDir_dot_axis * rDir_dot_axis - cosA2;
  const b = 2 * (rDir_dot_axis * co_dot_axis - vec3.dot(direction, co) * cosA2);
  const c = co_dot_axis * co_dot_axis - vec3.dot(co, co) * cosA2;

  let det = b * b - 4 * a * c;
  if (det < 0) {
      return null;
  }
  det = Math.sqrt(det);
  const t1 = (-b - det) / (2. * a);
  const t2 = (-b + det) / (2. * a);
  let t = t1;
  if (t < 0. || t2 > 0. && t2 < t) {
      t = t2;
  }
  if (t < 0.)  {
      return null;
  }
  const cp = vec3.sub(vec3.create(), vec3.add(vec3.create(), origin, vec3.scale(vec3.create(), direction, t)), cone.tipPos);
  const h = vec3.dot(cp, cone.axis);
  if (h < 0 || h > cone.height) {
      return null;
  }
  const axis_dot_cp = vec3.dot(cone.axis, cp);
  const cp2 = vec3.dot(cp, cp);
  const n = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), vec3.scale(vec3.create(), cp, axis_dot_cp / cp2), cone.axis));
  return {
      t: t,
      n: n,
  };
}