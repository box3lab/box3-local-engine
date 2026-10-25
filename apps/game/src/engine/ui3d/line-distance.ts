import { vec3 } from 'gl-matrix';
import { toVec3 } from '../utils/vec3';

//http://geomalgorithms.com/a07-_distance.html

const EPSILON = 1e-6;

export type Line = {
  origin: ArrayLike<number>,
  dir: ArrayLike<number>,
};

export function distanceLineToLine(L1:Line, L2:Line) {
  const u = toVec3(L1.dir);
  const v = toVec3(L2.dir);
  const w = vec3.sub(vec3.create(), toVec3(L1.origin), toVec3(L2.origin));
  const a = vec3.dot(u, u);
  const b = vec3.dot(u, v);
  const c = vec3.dot(v, v);
  const d = vec3.dot(u, w);
  const e = vec3.dot(v, w);
  const D = a * c - b * b;

  let sc:number;
  let tc:number;

  if (D < EPSILON) { // the lines are almost parallel
    sc = 0.0;
    tc = (b > c ? (d / b) : (e / c)); // use the largest denominator
  } else {
    sc = ((b * e) - (c * d)) / D;
    tc = ((a * e) - (b * d)) / D;
  }
  const P1 = vec3.scale(vec3.create(), u, sc); // L1(sc)
  const P2 = vec3.scale(vec3.create(), v, tc); // L2(tc)
  const dP = vec3.add(vec3.create(), w, vec3.sub(vec3.create(), P1, P2));
  return {
    distance: vec3.len(dP),
    l1Scale: sc,
    l2Scale: tc,
  };
}

export type Segment = {
  start: ArrayLike<number>,
  end: ArrayLike<number>,
};

export function distanceSegmentToSegment(S1:Segment, S2:Segment) {
  const start1 = toVec3(S1.start);
  const end1 = toVec3(S1.end);
  const start2 = toVec3(S2.start);
  const end2 = toVec3(S2.end);
  const u = vec3.sub(vec3.create(), end1, start1);
  // vec3.normalize(u, u);
  const v = vec3.sub(vec3.create(), end2, start2);
  // vec3.normalize(v, v);

  const w = vec3.sub(vec3.create(), start1, start2);
  const a = vec3.dot(u, u);
  const b = vec3.dot(u, v);
  const c = vec3.dot(v, v);
  const d = vec3.dot(u, w);
  const e = vec3.dot(v, w);
  const D = a * c - b * b;

  // sc = sN / sD, default sD = D >= 0
  let sc:number;
  let sN:number;
  let sD = D;

  // tc = tN / tD, default tD = D >= 0
  let tc:number;
  let tN:number;
  let tD = D;

  if (D < EPSILON) {  // the lines are almost parallel
    sN = 0.0;
    sD = 1.0;
    tN = e;
    tD = c;
  } else {
    sN = (b * e - c * d);
    tN = (a * e - b * d);
    if (sN < 0.0) {        // sc < 0 => the s=0 edge is visible
      sN = 0.0;
      tN = e;
      tD = c;
    } else if (sN > sD) {  // sc > 1  => the s=1 edge is visible
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0.0) {  // tc < 0 => the t=0 edge is visible
    tN = 0.0;
    // recompute sc for this edge
    if (-d < 0.0) {
      sN = 0.0;
    } else if (-d > a) {
      sN = sD;
    } else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {  // tc > 1  => the t=1 edge is visible
    tN = tD;
    // recompute sc for this edge
    if ((-d + b) < 0.0) {
      sN = 0;
    } else if ((-d + b) > a) {
      sN = sD;
    } else {
      sN = (-d + b);
      sD = a;
    }
  }
  sc = (Math.abs(sN) < EPSILON ? 0.0 : sN / sD);
  tc = (Math.abs(tN) < EPSILON ? 0.0 : tN / tD);

  const P1 = vec3.scale(vec3.create(), u, sc); // S1(sc)
  const P2 = vec3.scale(vec3.create(), v, tc); // S2(tc)
  const dP = vec3.add(vec3.create(), w, vec3.sub(vec3.create(), P1, P2));

  return {
    distance: vec3.length(dP),
    s1Scale: sc,
    s2Scale: tc,
  };
}

export function distanceLineToSegment(L:Line, S:Segment) {
  const u = toVec3(L.dir);
  const start = toVec3(S.start);
  const end = toVec3(S.end);
  const v = vec3.sub(vec3.create(), end, start);
  // vec3.normalize(v, v);
  const w = vec3.sub(vec3.create(), toVec3(L.origin), start);
  const a = vec3.dot(u, u);
  const b = vec3.dot(u, v);
  const c = vec3.dot(v, v);
  const d = vec3.dot(u, w);
  const e = vec3.dot(v, w);
  const D = a * c - b * b;

  let sc;
  let sN;
  let sD = D;

  let tc;
  let tN;
  let tD = D;

  if (D < EPSILON) {  // the lines are almost parallel
    sN = 0.0;   // force using point P0 on segment S1
    sD = 1.0;   // to prevent possible division by 0.0 later
    tN = e;
    tD = c;
  } else {
    sN = (b * e - c * d);
    tN = (a * e - b * d);
    if (sN < 0.0) {
      sN = 0.0;
      tN = e;
      tD = c;
    }
  }
  if (tN < 0.0) {
    tN = 0.0;
    if (-d < 0.0) {
      sN = 0.0;
    } else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if ((-d + b) < 0.0) {
      sN = 0;
    } else {
      sN = (-d + b);
      sD = a;
    }
  }

  sc = (Math.abs(sN) < EPSILON ? 0.0 : sN / sD);
  tc = (Math.abs(tN) < EPSILON ? 0.0 : tN / tD);

  const P1 = vec3.scale(vec3.create(), u, sc); // L(sc)
  const P2 = vec3.scale(vec3.create(), v, tc); // S(tc)
  const dP = vec3.add(vec3.create(), w, vec3.sub(vec3.create(), P1, P2));

  return {
    distance: vec3.len(dP),
    l1Scale: sc,
    s2Scale: tc,
  };
}