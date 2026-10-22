import { vec3 } from 'gl-matrix';

export function toVec3(value: ArrayLike<number>): vec3 {
  return vec3.fromValues(value[0], value[1], value[2]);
}
