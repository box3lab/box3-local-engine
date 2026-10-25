import { vec3, mat3, mat4, quat } from 'gl-matrix';

const EPSILON = 1e-6;

export function rotateVector(vector:vec3, origin:vec3, rotation:quat) {
    vec3.sub(vector, vector, origin);
    vec3.transformQuat(vector, vector, rotation);
    vec3.add(vector, vector, origin);
}

export function rotateBox(lo:vec3, hi:vec3, rotation:quat) {
    const _lo = vec3.create();
    const _hi = vec3.create();
    rotateVector(lo, vec3.create(), rotation);
    rotateVector(hi, vec3.create(), rotation);

    _lo[0] = Math.min(lo[0], hi[0]);
    _lo[1] = Math.min(lo[1], hi[1]);
    _lo[2] = Math.min(lo[2], hi[2]);
    _hi[0] = Math.max(lo[0], hi[0]);
    _hi[1] = Math.max(lo[1], hi[1]);
    _hi[2] = Math.max(lo[2], hi[2]);
    return {
        lo: _lo,
        hi: _hi,
    };
}

export function rotateVectorByMat3(out:vec3, _r:mat3, origin?:vec3) {
    const o = origin ?? vec3.fromValues(0, 0, 0);
    vec3.sub(out, out, o);
    vec3.transformMat3(out, out, _r);
    vec3.add(out, out, o);
}

export function mat4FromMat3(out:mat4, m:mat3) {
    out[0] = m[0];
    out[1] = m[3];
    out[2] = m[6];
    out[3] = 0;
    out[4] = m[1];
    out[5] = m[4];
    out[6] = m[7];
    out[7] = 0;
    out[8] = m[2];
    out[9] = m[5];
    out[10] = m[8];
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
}

/**
 * Returns an euler angle representation of a quaternion
 * @param  {vec3} out Euler angles, pitch-yaw-roll
 * @param  {quat} mat Quaternion
 * @return {vec3} out
 */
export function getEuler(out:vec3, q:quat) {
    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];
    const x2 = x * x;
    const y2 = y * y;
    const z2 = z * z;
    const w2 = w * w;
    const unit = x2 + y2 + z2 + w2;
    const test = x * w - y * z;
    if (test > 0.5 * unit - EPSILON) {
        // singularity at the north pole
        out[0] = 2 * Math.atan2(y, x);
        out[1] = Math.PI / 2;
        out[2] = 0;
    } else if (test < -0.5 * unit + EPSILON) {
        // singularity at the south pole
        out[0] = 2 * Math.atan2(y, x);
        out[1] = -Math.PI / 2;
        out[2] = 0;
    } else {
        out[0] = Math.atan2(2 * (x * w + y * z), 1 - 2 * (z2 + w2));
        out[1] = Math.asin(2 * (x * z - w * y));
        out[2] = Math.atan2(2 * (x * y + z * w), 1 - 2 * (y2 + z2));
    }

    if (out[0] > 0) {
        out[0] = (180 - out[0] * 180 / Math.PI) % 180;
    } else {
        out[0] = (-180 - out[0] * 180 / Math.PI) % 180;
    }

    if (Math.abs(out[1] * 180 / Math.PI) < 90) {
        out[1] = -out[1] * 180 / Math.PI;
    } else {
        out[1] = -1 * out[1] / Math.abs[out[1]] * 180 + out[1];
    }
    out[2] = out[2] * 180 / Math.PI;

    return out;
}

const degPerRad = 180 / Math.PI;

export function quatToAxisAngleForm(q:quat) {
    const axis = vec3.create();
    let angle = quat.getAxisAngle(axis, q);
    angle = angle * degPerRad;
    return {axis, angle};
}