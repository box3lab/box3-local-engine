import { vec3, vec2 } from 'gl-matrix';
import { toVec3 } from '../../../../../engine/utils/vec3';

const nor = vec3.create();
const O = vec3.create();
export function QuadGeometry(n: vec3 | number[], r: number) {
  const indices: vec3[] = [];
  const vertices: vec3[] = [];
  const uv: vec2[] = [];

  indices.push(toVec3([0, 1, 2]));
  indices.push(toVec3([1, 3, 2]));

  vec3.normalize(nor, toVec3(n));
  const shadow_yz = toVec3([0, nor[1], nor[2]]);
  const len_shadow_yz = vec3.len(shadow_yz);

  let uv_x: vec3;
  let uv_y: vec3;
  if (len_shadow_yz === 0) {
    vertices.push(toVec3([0, -r, -r]));
    vertices.push(toVec3([0, r, -r]));
    vertices.push(toVec3([0, -r, r]));
    vertices.push(toVec3([0, r, r]));

    uv_x = toVec3([0, 1, 0]);
    uv_y = toVec3([0, 0, 1]);
    uv.push(vec2.clone([-r, -r]));
    uv.push(vec2.clone([r, -r]));
    uv.push(vec2.clone([-r, r]));
    uv.push(vec2.clone([r, r]));
  } else {
    uv.push(vec2.clone([r, -r]));
    uv.push(vec2.clone([r, r]));
    uv.push(vec2.clone([-r, -r]));
    uv.push(vec2.clone([-r, r]));
    uv_x = toVec3([0, 0, 1]);
    uv_y = toVec3([1, 0, 0]);

    // FIXME: should consider major angle while use dot to compute cosTheta and cosPhi
    // acos will renturn [0, π] https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acos
    const cosTheta = vec3.dot(shadow_yz, [0, 1, 0]) / len_shadow_yz;
    const cosPhi = vec3.dot(nor, shadow_yz);
    const theta = Math.acos(cosTheta);
    const phi = Math.acos(cosPhi);
    const v1 = vec3.rotateX(vec3.create(), toVec3([-r, 0, r]), O, theta);
    const v11 = vec3.rotateY(v1, v1, O, phi);

    const v2 = vec3.rotateX(vec3.create(), toVec3([r, 0, r]), O, theta);
    const v22 = vec3.rotateY(v2, v2, O, phi);

    const v3 = vec3.rotateX(vec3.create(), toVec3([-r, 0, -r]), O, theta);
    const v33 = vec3.rotateY(v3, v3, O, phi);

    const v4 = vec3.rotateX(vec3.create(), toVec3([r, 0, -r]), O, theta);
    const v44 = vec3.rotateY(v4, v4, O, phi);

    vec3.rotateX(uv_x, uv_x, O, theta);
    vec3.rotateY(uv_x, uv_x, O, phi);

    vec3.rotateX(uv_y, uv_y, O, theta);
    vec3.rotateY(uv_y, uv_y, O, phi);

    vertices.push(v11);
    vertices.push(v22);
    vertices.push(v33);
    vertices.push(v44);
  }

  return {
    vertices,
    indices,
    uv,
    uv_x,
    uv_y,
  };
}
