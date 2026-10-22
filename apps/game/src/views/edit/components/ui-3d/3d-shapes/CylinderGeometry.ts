import { vec3, vec2 } from 'gl-matrix';
import { toVec3 } from '../../../../../engine/utils/vec3';

const nor = vec3.create();
const O = vec3.create();
export function CylinderGeometry(
  n: vec3,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  heightSegments: number,
  openEnded: boolean,
  thetaStart: number,
  thetaLength: number,
) {
  vec3.normalize(nor, n);
  const shadow_yz = toVec3([0, nor[1], nor[2]]);
  const len_shadow_yz = vec3.len(shadow_yz);

  let nbCap = 0;

  if (openEnded === false) {
    if (radiusTop > 0) {
      nbCap++;
    }
    if (radiusBottom > 0) {
      nbCap++;
    }
  }

  const indices: vec3[] = [];
  const vertices: vec3[] = [];
  const normals: vec3[] = [];
  const uvs: number[] = [];

  let index = 0;
  const indexArray: number[][] = [];
  const halfHeight = height / 2;

  generateTorso();

  if (openEnded === false) {
    if (radiusTop > 0) {
      generateCap(true);
    }
    if (radiusBottom > 0) {
      generateCap(false);
    }
  }

  if (len_shadow_yz !== 0) {
    vertices.forEach((v) => {
      // FIXME: should consider major angle while use dot to compute cosTheta and cosPhi
      // acos will renturn [0, π] https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acos
      const cosTheta = vec3.dot(shadow_yz, toVec3([0, 1, 0])) / len_shadow_yz;
      const cosPhi = vec3.dot(nor, shadow_yz);
      const theta = Math.acos(cosTheta);
      const phi = Math.acos(cosPhi);
      vec3.rotateX(v, v, O, theta);
      vec3.rotateY(v, v, O, phi);
    });
  } else {
    vertices.forEach((v) => {
      vec3.copy(v, vec3.fromValues(v[1], v[0], v[2]));
    });
  }

  return {
    indices,
    vertices,
    normals,
    uvs,
  };

  // generate torso
  function generateTorso() {
    let x;
    let y;
    const normal = vec3.create();
    const vertex = vec3.create();

    // let groupCount = 0;
    // this will be used to calculate the normal
    const slope = (radiusBottom - radiusTop) / height;

    // generate vertices, normals and uvs
    for (y = 0; y <= heightSegments; y++) {
      const indexRow: number[] = [];
      const v = y / heightSegments;

      const radius = v * (radiusBottom - radiusTop) + radiusTop;

      for (x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments;
        const theta = u * thetaLength + thetaStart;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        vertex[0] = radius * sinTheta;
        vertex[1] = -v * height + halfHeight;
        vertex[2] = radius * cosTheta;
        vertices.push(vec3.fromValues(vertex[0], vertex[1], vertex[2]));
        normal[0] = sinTheta;
        normal[1] = slope;
        normal[2] = cosTheta;
        vec3.normalize(normal, normal);
        normals.push(vec3.fromValues(normal[0], normal[1], normal[2]));

        uvs[index * 2] = u;
        uvs[index * 2 + 1] = 1 - v;
        indexRow.push(index);

        index++;
      }
      indexArray.push(indexRow);
    }

    // generate indices
    for (x = 0; x < radialSegments; x++) {
      for (y = 0; y < heightSegments; y++) {
        const i1 = indexArray[y][x];
        const i2 = indexArray[y + 1][x];
        const i3 = indexArray[y + 1][x + 1];
        const i4 = indexArray[y][x + 1];

        indices.push(vec3.fromValues(i1, i2, i4));
        indices.push(vec3.fromValues(i2, i3, i4));
      }
    }
  }

  function generateCap(top) {
    let x;
    let centerIndexEnd;

    const uv = vec2.create();
    const vertex = vec3.create();

    const radius = top === true ? radiusTop : radiusBottom;
    const sign = top === true ? 1 : -1;

    const centerIndexStart = index;
    for (x = 1; x <= radialSegments; x++) {
      vertices.push(vec3.fromValues(0, halfHeight * sign, 0));
      normals.push(vec3.fromValues(0, sign, 0));
      uv[0] = 0.5;
      uv[1] = 0.5;

      uvs[index * 2] = uv[0];
      uvs[index * 2 + 1] = uv[1];

      index++;
    }
    centerIndexEnd = index;

    for (x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * thetaLength + thetaStart;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      vertex[0] = radius * sinTheta;
      vertex[1] = halfHeight * sign;
      vertex[2] = radius * cosTheta;
      vertices.push(vec3.fromValues(vertex[0], vertex[1], vertex[2]));
      normals.push(vec3.fromValues(0, sign, 0));

      uv[0] = cosTheta * 0.5 + 0.5;
      uv[1] = sinTheta * 0.5 * sign + 0.5;
      uvs[index * 2] = uv[0];
      uvs[index * 2 + 1] = uv[1];

      index++;
    }

    // generate indices
    for (x = 0; x < radialSegments; x++) {
      const c = centerIndexStart + x;
      const i = centerIndexEnd + x;

      if (top === true) {
        indices.push(vec3.fromValues(i, i + 1, c));
      } else {
        indices.push(vec3.fromValues(i + 1, i, c));
      }
    }
  }
}
