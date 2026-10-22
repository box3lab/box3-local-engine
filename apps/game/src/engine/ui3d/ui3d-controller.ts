import { GameClientState } from '../game-client-schema';
import { pixelToRay } from '../camera/camera-controller';
import { vec3, vec2, mat4 } from 'gl-matrix';
import { toVec3 } from '../utils/vec3';
import {
  VoxelRaycastHitResult,
  raycast,
} from '@box/schema/voxel/voxel-raycast';
import {
  UI3DEventSchema,
  UI3DVoxelHandler,
  UI3DEntityHandler,
  UI3DMouseHandler,
  UI3DEventQueueSchema,
  UI3DMouseEventSchema,
  UI3DVoxelEventSchema,
  UI3DEntityEventSchema,
  UI3DConeMouseEventSchema,
  UI3DRingMouseEventSchema,
  UI3DLineSpec,
  UI3DSphereSpec,
  UI3DTextSpec,
  UI3DConeSpec,
  UI3DQuadSpec,
  UI3DRingSpec,
  UI3DBoxSpec,
  UI3DElement,
  UI3DSeedSpec,
  UI3DEventQueue,
  onContextMenuHandler,
} from './ui3d-schema';
import { boxRayIntersectRecip } from '@box/schema/physics/box-collide';
import { raySphere } from '../utils/ray-sphere';
import { intersectCone, TestCone } from '../utils/ray-cone';
import { rayTriangle } from '../utils/ray-triangle';
import { rayHitBox } from '../utils/ray';
import { distanceLineToSegment, distanceLineToLine } from './line-distance';
import { Vec2Schema } from '@box/schema/utils/math-schema';
import { MouseState } from '@box/schema/input/input-schema';
import { isGLMesh, isGPUMesh } from '../mesh/renderable-schema';

export function traverseUI3D(
  state: GameClientState,
  opaqueSeeds: UI3DElement[],
  transparentSeeds: UI3DElement[],
  others: UI3DElement[],
) {
  const elements = state.ui3D.elements;
  for (let i = 0; i < elements.length; ++i) {
    if (elements[i].type === 'seed') {
      const seedData = elements[i].data as UI3DSeedSpec;
      if (seedData.color[3] !== 1 || seedData.meshIsTransparent) {
        transparentSeeds.push(elements[i]);
        /**
         * GL多部件透明渲染兼容：
         * GL不使用OIT做透明渲染，纯靠透明物体的排序模拟透明颜色的叠加顺序
         * 当透明物体进入水地形(水地形即为透明物体)时无法透过透明物体
         * 当部件为多部件的时候，部分部件其实不是透明的但也遵循这个规则导致无法透过水地形
         *
         * 因此当为GL渲染时，整体为非透明但多部件中的部分部件透明时候，要在不透明的队列里多渲染一遍，
         */
        if (isGLMesh(seedData.glRef) && seedData.color[3] === 1) {
          opaqueSeeds.push(elements[i]);
        }
      } else {
        opaqueSeeds.push(elements[i]);
      }
    } else {
      others.push(elements[i]);
    }
  }
}

const testRay = vec3.create();
const hit = new VoxelRaycastHitResult();

function getMouseEvent(opt: {
  hitDistance?: number;
  type: typeof UI3DEventSchema.identity.event.type;
  handler: typeof UI3DEventSchema.identity.handler;
  mousePosition: vec2;
  mouseState: number;
  mouseButton: number;
  origin: vec3;
}) {
  const e = UI3DEventSchema.alloc();
  e.hitDistance = opt.hitDistance || 0;
  e.handler = opt.handler;
  e.event.type = opt.type;
  const data = (e.event.data = UI3DMouseEventSchema.alloc());
  data.mouseState = opt.mouseState;
  data.mouseButton = opt.mouseButton;
  vec3.copy(data.eye, opt.origin);
  vec2.copy(data.screenPosition, opt.mousePosition);
  if (opt.hitDistance !== undefined) {
    vec3.scaleAndAdd(data.worldPosition, opt.origin, testRay, opt.hitDistance);
  }
  return e;
}

function getMouseOutEventObject(
  type: any,
  handler: any,
  mouseState: number,
  mouseButton: number,
  origin: vec3,
) {
  const e = UI3DEventSchema.alloc();
  e.handler = handler;
  e.event.type = type;
  const data = (e.event.data = UI3DMouseEventSchema.alloc());
  vec3.copy(data.eye, origin);
  data.mouseState = mouseState;
  data.mouseButton = mouseButton;
  return e;
}

const lineOffset = vec3.create();
const lineStart = vec3.create();
const lineEnd = vec3.create();
const segmentDir = vec3.create();
const normalDir = vec3.create();
const weight = [
  [0, 1],
  [0, -1],
  [1, -1],
  [1, 1],
  [1, -1],
  [0, 1],
];
const quadPos = [
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create(),
];
const base = vec3.create();
const eyeDir = vec3.create();

function mix(out: vec3, x: vec3, y: vec3, a: number) {
  out[0] = x[0] * (1 - a) + y[0] * a;
  out[1] = x[1] * (1 - a) + y[1] * a;
  out[2] = x[2] * (1 - a) + y[2] * a;
  return out;
}

function handleLine(
  mousePosition: vec2,
  mouseState: number,
  mouseButton: number,
  origin: vec3,
  events: UI3DEventQueue,
  mouseInEvents: UI3DEventQueue,
  mouseOutEvents: UI3DEventQueue,
  line: UI3DLineSpec,
) {
  if (
    !line.onMouseChange &&
    !line.onDragStart &&
    !line.onMouseIn &&
    !line.onMouseOut
  ) {
    return;
  }

  const { start, end, width } = line;
  if (line.quadDetection) {
    for (let i = 0; i < weight.length; i++) {
      mix(base, start, end, weight[i][0]);
      vec3.sub(segmentDir, end, start);
      vec3.sub(eyeDir, origin, base);
      vec3.normalize(normalDir, vec3.cross(normalDir, segmentDir, eyeDir));
      vec3.scale(quadPos[i], normalDir, width * weight[i][1]);
      vec3.add(quadPos[i], quadPos[i], base);
    }
    const tris = [
      [quadPos[0], quadPos[2], quadPos[1]],
      [quadPos[3], quadPos[4], quadPos[5]],
    ];
    let rst: number | null = null;
    for (let i = 0; i < tris.length; i++) {
      rst = rayTriangle(tris[i], { origin: origin, dir: testRay });
      if (rst !== null) {
        break;
      }
    }
    if (rst === null) {
      if (line.mouseOn) {
        if (line.onMouseOut !== undefined && line.onMouseOut !== null) {
          const e = getMouseOutEventObject(
            'mouse',
            line.onMouseOut,
            mouseState,
            mouseButton,
            origin,
          );
          mouseOutEvents.push(e);
        }
      }
      line.mouseOn = false;
      return;
    } else {
      const e = getMouseEvent({
        hitDistance: rst,
        type: 'mouse',
        handler: line.onMouseChange,
        mousePosition,
        mouseState,
        mouseButton,
        origin,
      });
      events.push(e);
      if (
        mouseState === MouseState.drag &&
        prevMouseState !== MouseState.drag
      ) {
        const dragStartE = getMouseEvent({
          hitDistance: rst,
          type: 'mouse',
          handler: line.onDragStart,
          mousePosition,
          mouseState,
          mouseButton,
          origin,
        });
        events.push(dragStartE);
      }
      if (line.mouseOn === false) {
        if (line.onMouseIn !== undefined && line.onMouseIn !== null) {
          const e2 = UI3DEventSchema.clone(e);
          e2.handler = line.onMouseIn;
          mouseInEvents.push(e2);
        }
      }
      line.mouseOn = true;
    }
  } else {
    // vec3.sub(segmentDir, start, end);
    vec3.sub(segmentDir, end, start);
    vec3.normalize(segmentDir, segmentDir);
    let hotWidth = width + 0.1;
    if (line.screenSizeFixed) {
      vec3.sub(lineOffset, end, start);
      const scale = vec3.distance(origin, start);
      hotWidth = (hotWidth * scale) / line.fixedSize;
      vec3.copy(lineStart, start);
      vec3.scaleAndAdd(lineEnd, start, lineOffset, scale / line.fixedSize);
    } else {
      vec3.copy(lineStart, start);
      vec3.copy(lineEnd, end);
    }
    const rst = line.isDragging
      ? distanceLineToLine(
          { origin: origin, dir: testRay },
          { origin: start, dir: segmentDir },
        )
      : distanceLineToSegment(
          { origin: origin, dir: testRay },
          { start: lineStart, end: lineEnd },
        );
    if (rst.distance > hotWidth && !line.isDragging) {
      if (line.mouseOn) {
        if (line.onMouseOut !== undefined && line.onMouseOut !== null) {
          mouseOutEvents.push(
            getMouseOutEventObject(
              'mouse',
              line.onMouseOut,
              mouseState,
              mouseButton,
              origin,
            ),
          );
        }
      }
      line.mouseOn = false;
      return;
    }
    const e = getMouseEvent({
      hitDistance: rst.l1Scale,
      type: 'mouse',
      handler: line.onMouseChange,
      mousePosition,
      mouseState,
      mouseButton,
      origin,
    });
    events.push(e);
    if (mouseState === MouseState.drag && prevMouseState !== MouseState.drag) {
      const dragStartE = getMouseEvent({
        hitDistance: rst.l1Scale,
        type: 'mouse',
        handler: line.onDragStart,
        mousePosition,
        mouseState,
        mouseButton,
        origin,
      });
      events.push(dragStartE);
    }
    if (line.mouseOn === false) {
      if (line.onMouseIn !== undefined && line.onMouseIn !== null) {
        const e2 = UI3DEventSchema.clone(e);
        e2.handler = line.onMouseIn;
        mouseInEvents.push(e2);
      }
      line.mouseOn = true;
    }
  }
}

function handleText(
  mousePosition: vec2,
  mouseState: number,
  mouseButton: number,
  eye: vec3,
  events: UI3DEventQueue,
  text: UI3DTextSpec,
) {
  // test for text event
  if (!text.onMouseChange) {
    return;
  }

  const t = raySphere(
    eye[0],
    eye[1],
    eye[2],
    testRay[0],
    testRay[1],
    testRay[2],
    text.position[0],
    text.position[1],
    text.position[2],
    text.scale,
  );

  if (t >= Infinity || t <= 0) {
    return;
  }

  const e = UI3DEventSchema.alloc();
  e.hitDistance = t;
  e.handler = text.onMouseChange;
  e.event.type = 'mouse';
  const data = (e.event.data = UI3DMouseEventSchema.alloc());

  // set mouse state
  data.mouseState = mouseState;
  data.mouseButton = mouseButton;
  vec3.copy(data.eye, eye);
  vec2.copy(data.screenPosition, mousePosition);
  vec3.scaleAndAdd(data.worldPosition, eye, testRay, t);

  // push event
  events.push(e);
}

function handlePoint(
  mousePosition: vec2,
  mouseState: number,
  mouseButton: number,
  eye: vec3,
  events: UI3DEventQueue,
  point: UI3DSphereSpec,
) {
  if (!point.onMouseChange) {
    return;
  }

  const t = raySphere(
    eye[0],
    eye[1],
    eye[2],
    testRay[0],
    testRay[1],
    testRay[2],
    point.position[0],
    point.position[1],
    point.position[2],
    point.radius,
  );

  if (t >= Infinity || t <= 0) {
    return;
  }

  const e = UI3DEventSchema.alloc();
  e.hitDistance = t;
  e.handler = point.onMouseChange;
  e.event.type = 'mouse';
  const data = (e.event.data = UI3DMouseEventSchema.alloc());

  data.mouseState = mouseState;
  data.mouseButton = mouseButton;
  vec3.copy(data.eye, eye);
  vec2.copy(data.screenPosition, mousePosition);
  vec3.scaleAndAdd(data.worldPosition, eye, testRay, t);

  events.push(e);
}

function sizeFixedTransform(
  out: vec3,
  eye: vec3 | number[],
  M: mat4,
  p: vec3 | number[],
  size: number,
  offset: vec3 | number[],
) {
  const eyeVector = toVec3(eye);
  const point = toVec3(p);
  const offsetVector = toVec3(offset);
  vec3.transformMat4(out, point, M);
  const scale = vec3.distance(eyeVector, out);
  vec3.transformMat4(out, vec3.scale(out, point, scale / size), M);
  const pos = vec3.scaleAndAdd(out, out, offsetVector, scale / size);
  return {
    pos,
    scaleIndex: scale / size,
  };
}

function sizeFixedTransformWithCenter(
  out: vec3,
  eye: vec3 | number[],
  M: mat4,
  p: vec3 | number[],
  relateP: vec3 | number[],
  size: number,
  offset: vec3 | number[],
) {
  const eyeVector = toVec3(eye);
  const relatePoint = toVec3(relateP);
  const point = toVec3(p);
  const offsetVector = toVec3(offset);
  const scale = vec3.distance(eyeVector, relatePoint);
  vec3.transformMat4(out, vec3.scale(out, point, scale / size), M);
  const pos = vec3.scaleAndAdd(out, out, offsetVector, scale / size);
  return {
    pos,
    scaleIndex: scale / size,
  };
}

const tipPos = vec3.create();
const bottomCPos = vec3.create();
const coneAxis = vec3.create();
const centerPos = vec3.create();
function handleCone(
  mousePosition: vec2,
  mouseState: number,
  mouseButton: number,
  eye: vec3,
  events: UI3DEventQueue,
  cone: UI3DConeSpec,
) {
  if (!cone.onMouseChange && !cone.onDragStart) {
    return;
  }
  const tips = cone.vertices[0];
  const bottomC = cone.vertices[1];
  const offset = cone.offset;
  const M = mat4.multiply(mat4.create(), cone.translateMat, cone.rotateMat);
  let rst: any = null;
  let scaleIndex = 1;
  if (cone.screenSizeFixed) {
    const fixedSize = cone.fixedSize;
    sizeFixedTransform(tipPos, eye, M, tips, fixedSize, offset);
    scaleIndex = sizeFixedTransform(
      bottomCPos,
      eye,
      M,
      bottomC,
      fixedSize,
      offset,
    ).scaleIndex;
    sizeFixedTransform(centerPos, eye, M, [0, 0, 0], fixedSize, [0, 0, 0]);
    const height = vec3.distance(tipPos, bottomCPos);
    vec3.normalize(coneAxis, vec3.sub(coneAxis, bottomCPos, tipPos));
    const testCone: TestCone = {
      cosa: cone.cosA,
      axis: coneAxis,
      height: height,
      tipPos: tipPos,
    };
    rst = intersectCone(testCone, { origin: eye, dir: testRay });
  } else {
    vec3.add(tipPos, vec3.transformMat4(tipPos, tips, M), offset);
    vec3.add(bottomCPos, vec3.transformMat4(bottomCPos, bottomC, M), offset);
    const height = vec3.distance(tipPos, bottomCPos);
    vec3.normalize(coneAxis, vec3.sub(coneAxis, bottomCPos, tipPos));
    const testCone: TestCone = {
      cosa: cone.cosA,
      axis: coneAxis,
      height: height,
      tipPos: tipPos,
    };
    rst = intersectCone(testCone, { origin: eye, dir: testRay });
  }
  if (rst) {
    const e = UI3DEventSchema.alloc();
    e.hitDistance = rst.t;
    e.handler = cone.onMouseChange;
    e.event.type = 'mouseCone';
    const data = (e.event.data = UI3DConeMouseEventSchema.alloc());
    data.mouseState = mouseState;
    data.mouseButton = mouseButton;
    vec2.copy(data.screenPosition, mousePosition);
    vec3.copy(data.originPosition, centerPos);
    data.scaleIndex = scaleIndex;
    vec3.scaleAndAdd(data.worldPosition, eye, testRay, rst.t);

    events.push(e);

    if (mouseState === MouseState.drag && prevMouseState !== MouseState.drag) {
      const dragStartE = UI3DEventSchema.clone(e);
      e.handler = cone.onDragStart;
      events.push(dragStartE);
    }
  }
}

const p1 = vec3.create();
const p2 = vec3.create();
const p3 = vec3.create();
const p4 = vec3.create();
const v1 = vec3.create();
const v2 = vec3.create();
const v3 = vec3.create();
const v4 = vec3.create();
function handleQuad(
  mousePosition: vec2,
  mouseState: number,
  mouseButton: number,
  eye: vec3,
  events: UI3DEventQueue,
  mouseInEvents: UI3DEventQueue,
  mouseOutEvents: UI3DEventQueue,
  quad: UI3DQuadSpec,
) {
  if (!quad.onMouseChange && !quad.onMouseIn && !quad.onMouseOut) {
    return;
  }

  const M = quad.translateMat;
  vec3.copy(v1, quad.vertices[0]);
  vec3.copy(v2, quad.vertices[1]);
  vec3.copy(v3, quad.vertices[2]);
  vec3.copy(v4, quad.vertices[3]);
  if (quad.isDragging) {
    vec3.scale(v1, v1, 40);
    vec3.scale(v2, v2, 40);
    vec3.scale(v3, v3, 40);
    vec3.scale(v4, v4, 40);
  }

  if (quad.screenSizeFixed) {
    sizeFixedTransformWithCenter(
      p1,
      eye,
      M,
      v1,
      quad.center,
      quad.fixedSize,
      quad.offset,
    );
    sizeFixedTransformWithCenter(
      p2,
      eye,
      M,
      v2,
      quad.center,
      quad.fixedSize,
      quad.offset,
    );
    sizeFixedTransformWithCenter(
      p3,
      eye,
      M,
      v3,
      quad.center,
      quad.fixedSize,
      quad.offset,
    );
    sizeFixedTransformWithCenter(
      p4,
      eye,
      M,
      v4,
      quad.center,
      quad.fixedSize,
      quad.offset,
    );
  } else {
    vec3.add(p1, vec3.transformMat4(p1, v1, M), quad.offset);
    vec3.add(p2, vec3.transformMat4(p2, v2, M), quad.offset);
    vec3.add(p3, vec3.transformMat4(p3, v3, M), quad.offset);
    vec3.add(p4, vec3.transformMat4(p4, v4, M), quad.offset);
  }
  // both front face and back face need to check
  const tris = [
    [p1, p2, p3],
    [p2, p4, p3],
    [p1, p3, p2],
    [p2, p3, p4],
  ];
  let rst: number | null = null;
  for (let i = 0; i < tris.length; i++) {
    rst = rayTriangle(tris[i], { origin: eye, dir: testRay });
    if (rst !== null) {
      break;
    }
  }
  if (rst === null) {
    if (quad.mouseOn) {
      if (quad.onMouseOut !== undefined && quad.onMouseOut !== null) {
        const e = getMouseOutEventObject(
          'mouse',
          quad.onMouseOut,
          mouseState,
          mouseButton,
          eye,
        );
        mouseOutEvents.push(e);
      }
    }
    quad.mouseOn = false;
    return;
  } else {
    const e = getMouseEvent({
      hitDistance: rst,
      type: 'mouse',
      handler: quad.onMouseChange,
      mousePosition,
      mouseState,
      mouseButton,
      origin: eye,
    });
    events.push(e);
    if (quad.mouseOn === false) {
      if (quad.onMouseIn !== undefined && quad.onMouseIn !== null) {
        const e2 = UI3DEventSchema.clone(e);
        e2.handler = quad.onMouseIn;
        mouseInEvents.push(e2);
      }
    }
    quad.mouseOn = true;
  }
}

function handleRing(
  mousePosition: vec2,
  mouseState: number,
  mouseButton: number,
  eye: vec3,
  events: UI3DEventQueue,
  mouseInEvents: UI3DEventQueue,
  mouseOutEvents: UI3DEventQueue,
  ring: UI3DRingSpec,
) {
  if (
    !ring.onMouseChange &&
    !ring.onDragStart &&
    !ring.onMouseIn &&
    !ring.onMouseOut
  ) {
    return;
  }

  const M = ring.translateMat;
  const uv_x: vec3 = ring.uv_x;
  const uv_y: vec3 = ring.uv_y;
  let scaleIndex = 1;
  if (ring.screenSizeFixed) {
    scaleIndex = sizeFixedTransformWithCenter(
      p1,
      eye,
      M,
      ring.vertices[0],
      ring.center,
      ring.fixedSize,
      ring.offset,
    ).scaleIndex;
    sizeFixedTransformWithCenter(
      p2,
      eye,
      M,
      ring.vertices[1],
      ring.center,
      ring.fixedSize,
      ring.offset,
    );
    sizeFixedTransformWithCenter(
      p3,
      eye,
      M,
      ring.vertices[2],
      ring.center,
      ring.fixedSize,
      ring.offset,
    );
    sizeFixedTransformWithCenter(
      p4,
      eye,
      M,
      ring.vertices[3],
      ring.center,
      ring.fixedSize,
      ring.offset,
    );
  } else {
    vec3.add(p1, vec3.transformMat4(p1, ring.vertices[0], M), ring.offset);
    vec3.add(p2, vec3.transformMat4(p2, ring.vertices[1], M), ring.offset);
    vec3.add(p3, vec3.transformMat4(p3, ring.vertices[2], M), ring.offset);
    vec3.add(p4, vec3.transformMat4(p4, ring.vertices[3], M), ring.offset);
  }
  const c = [
    (p1[0] + p2[0] + p3[0] + p4[0]) / 4,
    (p1[1] + p2[1] + p3[1] + p4[1]) / 4,
    (p1[2] + p2[2] + p3[2] + p4[2]) / 4,
  ];
  // both front face and back face need to check
  const tris = [
    [p1, p2, p3],
    [p2, p4, p3],
    [p1, p3, p2],
    [p2, p3, p4],
  ];
  let rst: number | null = null;
  for (let i = 0; i < tris.length; i++) {
    rst = rayTriangle(tris[i], { origin: eye, dir: testRay });
    if (rst !== null) {
      break;
    }
  }
  if (rst !== null) {
    const e = UI3DEventSchema.alloc();
    e.hitDistance = rst;
    e.handler = ring.onMouseChange;
    e.event.type = 'mouseRing';
    const data = (e.event.data = UI3DRingMouseEventSchema.alloc());
    data.mouseState = mouseState;
    data.mouseButton = mouseButton;
    data.scaleIndex = scaleIndex;
    vec3.copy(data.ringCenter, toVec3(c));
    vec3.copy(data.uv_x, uv_x);
    vec3.copy(data.uv_y, uv_y);
    vec2.copy(data.screenPosition, mousePosition);
    vec3.scaleAndAdd(data.worldPosition, eye, testRay, rst);
    events.push(e);
    if (mouseState === MouseState.drag && prevMouseState !== MouseState.drag) {
      const dragStartE = UI3DEventSchema.clone(e);
      e.handler = ring.onDragStart;
      events.push(dragStartE);
    }
    if (ring.mouseOn === false) {
      if (ring.onMouseIn !== undefined && ring.onMouseIn !== null) {
        const e2 = UI3DEventSchema.alloc();
        e.event.type = 'mouseRing';
        UI3DEventSchema.assign(e2, e);
        e2.handler = ring.onMouseIn;
        mouseInEvents.push(e2);
      }
    }
    ring.mouseOn = true;
  } else {
    if (ring.mouseOn) {
      if (ring.onMouseOut !== undefined && ring.onMouseOut !== null) {
        const e = getMouseOutEventObject(
          'mouse',
          ring.onMouseOut,
          mouseState,
          mouseButton,
          eye,
        );
        mouseOutEvents.push(e);
      }
    }
    ring.mouseOn = false;
  }
}

const AABB = [
  vec3.fromValues(-0.5, -0.5, -0.5),
  vec3.fromValues(0.5, 0.5, 0.5),
];
const hitBoxRes = vec3.create();
function handleBox(
  mousePosition: vec2,
  mouseState: number,
  mouseButton: number,
  eye: vec3,
  events: UI3DEventQueue,
  mouseInEvents: UI3DEventQueue,
  mouseOutEvents: UI3DEventQueue,
  box: UI3DBoxSpec,
) {
  if (
    !box.onMouseChange &&
    !box.onDragStart &&
    !box.onMouseIn &&
    !box.onMouseOut
  ) {
    return;
  }
  vec3.set(AABB[0], -0.5, -0.5, -0.5);
  vec3.set(AABB[1], 0.5, 0.5, 0.5);
  if (box.centerAtBottom) {
    AABB[0][1] += 0.5;
    AABB[1][1] += 0.5;
  }
  vec3.mul(AABB[0], AABB[0], box.dimension);
  vec3.mul(AABB[1], AABB[1], box.dimension);
  const M = box.translateMat;
  if (box.screenSizeFixed) {
    sizeFixedTransformWithCenter(
      AABB[0],
      eye,
      M,
      AABB[0],
      box.position,
      box.fixedSize,
      box.offset,
    );
    sizeFixedTransformWithCenter(
      AABB[1],
      eye,
      M,
      AABB[1],
      box.position,
      box.fixedSize,
      box.offset,
    );
  } else {
    vec3.add(AABB[0], vec3.transformMat4(AABB[0], AABB[0], M), box.offset);
    vec3.add(AABB[1], vec3.transformMat4(AABB[1], AABB[1], M), box.offset);
  }
  const rst = rayHitBox(AABB[0], AABB[1], eye, testRay, hitBoxRes);
  if (rst) {
    const e = UI3DEventSchema.alloc();
    e.hitDistance = vec3.dist(hitBoxRes, eye);
    e.handler = box.onMouseChange;
    e.event.type = 'mouse';
    const data = (e.event.data = UI3DMouseEventSchema.alloc());
    data.mouseState = mouseState;
    data.mouseButton = mouseButton;
    vec3.copy(data.eye, eye);
    vec2.copy(data.screenPosition, mousePosition);
    vec3.copy(data.worldPosition, hitBoxRes);
    events.push(e);

    if (mouseState === MouseState.drag && prevMouseState !== MouseState.drag) {
      const dragStartE = UI3DEventSchema.clone(e);
      dragStartE.handler = box.onDragStart;
      events.push(dragStartE);
    }

    if (!box.mouseOn) {
      const mouseInE = UI3DEventSchema.clone(e);
      mouseInE.handler = box.onMouseIn;
      mouseInEvents.push(mouseInE);
      box.mouseOn = true;
    }
  } else if (box.mouseOn) {
    const e = getMouseOutEventObject(
      'mouse',
      box.onMouseOut,
      mouseState,
      mouseButton,
      eye,
    );
    mouseOutEvents.push(e);
    box.mouseOn = false;
  }
}

function compareEvent(
  a: typeof UI3DEventSchema.identity,
  b: typeof UI3DEventSchema.identity,
) {
  return a.hitDistance - b.hitDistance;
}

let prevMouseState = 0;
let prevMouseButton = 0;
export function processUI3DEvents(state: GameClientState) {
  let propagation = true;
  // initialize event queue
  const containerEvents = UI3DEventQueueSchema.clone(
    UI3DEventQueueSchema.identity,
  );
  const events = UI3DEventQueueSchema.clone(UI3DEventQueueSchema.identity);
  const mouseInEvents = UI3DEventQueueSchema.clone(
    UI3DEventQueueSchema.identity,
  );
  const mouseOutEvents = UI3DEventQueueSchema.clone(
    UI3DEventQueueSchema.identity,
  );
  // compute pixleRay
  const ray = pixelToRay(
    state,
    state.input.mouse[0],
    state.input.mouse[1],
    testRay,
  );
  const voxelHandlers: UI3DVoxelHandler[] = [];
  const contextMenuHandlers: onContextMenuHandler[] = [];
  const clickHandlers: UI3DMouseHandler[] = [];
  const dragStartHandlers: UI3DMouseHandler[] = [];
  const dragHandlers: UI3DMouseHandler[] = [];
  const dragEndHandlers: UI3DMouseHandler[] = [];
  const entityHandlers: UI3DEntityHandler[] = [];

  for (let head = state.ui3D.eventHandlers; !!head; head = head.next) {
    if (head.onMouseVoxel) {
      voxelHandlers.push(head.onMouseVoxel);
    }
    if (head.onContextMenu) {
      contextMenuHandlers.push(head.onContextMenu);
    }
    if (head.onClick) {
      clickHandlers.push(head.onClick);
    }
    if (head.onDragStart) {
      dragStartHandlers.push(head.onDragStart);
    }
    if (head.onDrag) {
      dragHandlers.push(head.onDrag);
    }
    if (head.onDragEnd) {
      dragEndHandlers.push(head.onDragEnd);
    }
    if (head.onMouseEntity) {
      entityHandlers.push(head.onMouseEntity);
    }
  }
  // perform initial voxel raycast
  if (voxelHandlers.length > 0) {
    if (
      raycast(
        hit,
        state.blockIndex,
        state.voxel,
        state.camera.eye,
        testRay,
        Infinity,
        state.camera.underwater,
      )
    ) {
      const rayHitEvent = UI3DEventSchema.alloc();
      rayHitEvent.event.type = 'voxel';

      const data = (rayHitEvent.event.data = UI3DVoxelEventSchema.alloc());
      data.block = hit.hitBlock;
      vec3.copy(data.hitNormal, hit.hitNormal);
      vec3.copy(data.worldPosition, hit.hitPosition);
      vec3.copy(data.voxelPosition, hit.hitVoxel);
      vec2.copy(data.screenPosition, state.input.mouse);
      data.mouseButton = state.input.mouseButton;
      data.mouseState = state.input.mouseState;
      rayHitEvent.handler = null;

      for (let i = 0; i < voxelHandlers.length; ++i) {
        let event = rayHitEvent;
        if (i > 0) {
          event = UI3DEventSchema.clone(rayHitEvent);
        }
        event.handler = voxelHandlers[i];
        events.push(event);
      }
    }
  }

  // loop over all objects to check which one got hit
  if (entityHandlers.length > 0) {
    const idx = 1 / testRay[0];
    const idy = 1 / testRay[1];
    const idz = 1 / testRay[2];

    const ox = state.camera.eye[0];
    const oy = state.camera.eye[0];
    const oz = state.camera.eye[0];

    for (let i = 0; i < state.bodies.length; ++i) {
      const { id, px, py, pz, rx, ry, rz } = state.bodies[i];

      const result = boxRayIntersectRecip(
        px - rx,
        py - ry,
        pz - rz,
        px + rx,
        py + ry,
        pz + rz,
        idx,
        idy,
        idz,
        ox,
        oy,
        oz,
      );

      if (!result.collides) {
        continue;
      }

      const entityEvent = UI3DEventSchema.alloc();
      entityEvent.hitDistance = result.t;
      entityEvent.event.type = 'entity';
      const data = (entityEvent.event.data = UI3DEntityEventSchema.alloc());
      data.id = id;
      data.mouseState = state.input.mouseState;
      vec2.copy(data.screenPosition, state.input.mouse);
      vec3.scaleAndAdd(data.worldPosition, state.camera.eye, testRay, result.t);
      vec3.set(data.worldNormal, 0, 0, 0);
      data.worldNormal[result.axis] = testRay[result.axis] < 0 ? 1 : -1;
      entityEvent.handler = null;

      for (let j = 0; j < entityHandlers.length; ++j) {
        let event = entityEvent;
        if (j > 0) {
          event = UI3DEventSchema.clone(entityEvent);
        }
        event.handler = entityHandlers[j];
        events.push(event);
      }
    }
  }
  const mouseCoord = state.input.mouse;
  const mouseState = state.input.mouseState;
  const mouseButton = state.input.mouseButton;
  if (
    prevMouseState === 1 &&
    mouseState === 0 &&
    prevMouseButton === 2 &&
    mouseButton === 2
  ) {
    if (contextMenuHandlers.length > 0) {
      const contextMenuEvent = UI3DEventSchema.alloc();
      contextMenuEvent.event.type = 'contextMenu';
      const data = (contextMenuEvent.event.data = Vec2Schema.alloc());
      vec2.copy(data, state.input.mouse);
      for (let i = 0; i < contextMenuHandlers.length; i++) {
        let event = contextMenuEvent;
        if (i > 0) {
          event = UI3DEventSchema.clone(contextMenuEvent);
        }
        event.handler = contextMenuHandlers[i];
        containerEvents.push(event);
      }
    }
  }

  if (
    mouseState === MouseState.release &&
    prevMouseState === MouseState.press
  ) {
    if (clickHandlers.length > 0) {
      for (let i = 0; i < clickHandlers.length; i++) {
        const e = getMouseEvent({
          type: 'mouse',
          handler: clickHandlers[i],
          mouseButton,
          mouseState,
          mousePosition: state.input.mouse,
          origin: state.camera.eye,
        });
        containerEvents.push(e);
      }
    }
  }

  if (mouseState === MouseState.drag && prevMouseState !== MouseState.drag) {
    if (dragStartHandlers.length > 0) {
      for (let i = 0; i < dragStartHandlers.length; i++) {
        const e = getMouseEvent({
          type: 'mouse',
          handler: dragStartHandlers[i],
          mouseButton,
          mouseState,
          mousePosition: state.input.mouse,
          origin: state.camera.eye,
        });
        containerEvents.push(e);
      }
    }
  }

  if (mouseState === MouseState.drag && prevMouseState === MouseState.drag) {
    if (dragHandlers.length > 0) {
      for (let i = 0; i < dragHandlers.length; i++) {
        const e = getMouseEvent({
          type: 'mouse',
          handler: dragHandlers[i],
          mouseButton,
          mouseState,
          mousePosition: state.input.mouse,
          origin: state.camera.eye,
        });
        containerEvents.push(e);
      }
    }
  }

  if (mouseState === MouseState.release && prevMouseState === MouseState.drag) {
    if (dragEndHandlers.length > 0) {
      for (let i = 0; i < dragEndHandlers.length; i++) {
        const e = getMouseEvent({
          type: 'mouse',
          handler: dragEndHandlers[i],
          mouseButton,
          mouseState,
          mousePosition: state.input.mouse,
          origin: state.camera.eye,
        });
        containerEvents.push(e);
      }
    }
  }
  const eye = state.camera.eye;
  // perform line intersection events
  const elements = state.ui3D.elements;
  for (let i = 0; i < elements.length; ++i) {
    const e = elements[i];
    switch (e.type) {
      case 'line':
        handleLine(
          mouseCoord,
          mouseState,
          mouseButton,
          eye,
          events,
          mouseInEvents,
          mouseOutEvents,
          <UI3DLineSpec>e.data,
        );
        break;
      case 'text':
        handleText(
          mouseCoord,
          mouseState,
          mouseButton,
          eye,
          events,
          <UI3DTextSpec>e.data,
        );
        break;
      case 'point':
        handlePoint(
          mouseCoord,
          mouseState,
          mouseButton,
          eye,
          events,
          <UI3DSphereSpec>e.data,
        );
        break;
      case 'cone':
        handleCone(
          mouseCoord,
          mouseState,
          mouseButton,
          eye,
          events,
          <UI3DConeSpec>e.data,
        );
        break;
      case 'quad':
        handleQuad(
          mouseCoord,
          mouseState,
          mouseButton,
          eye,
          events,
          mouseInEvents,
          mouseOutEvents,
          <UI3DQuadSpec>e.data,
        );
        break;
      case 'ring':
        handleRing(
          mouseCoord,
          mouseState,
          mouseButton,
          eye,
          events,
          mouseInEvents,
          mouseOutEvents,
          <UI3DRingSpec>e.data,
        );
        break;
      case 'box':
        handleBox(
          mouseCoord,
          mouseState,
          mouseButton,
          eye,
          events,
          mouseInEvents,
          mouseOutEvents,
          <UI3DBoxSpec>e.data,
        );
        break;
    }
  }

  // sort all events
  events.sort(compareEvent);
  mouseInEvents.sort(compareEvent);

  // check if event changed
  const prevEvents = state.ui3D.prevEventStack;
  if (prevEvents.length > 0 && prevEvents.length <= events.length) {
    let skipEvents = true;
    for (let i = 0; i < prevEvents.length; ++i) {
      if (!UI3DEventSchema.equal(prevEvents[i], events[i])) {
        skipEvents = false;
        break;
      }
    }
    if (skipEvents) {
      UI3DEventQueueSchema.free(events);
      return false;
    }
  }

  // process all event handlers
  state.ui3D.prevEventStack = UI3DEventQueueSchema.assign(
    state.ui3D.prevEventStack,
    [],
  );
  while (events.length > 0) {
    const e = events.shift();
    if (!e) {
      return false;
    }
    state.ui3D.prevEventStack.push(e);
    if (e.handler !== null && e.handler(e.event.data)) {
      propagation = false;
      break;
    }
  }

  if (propagation) {
    for (let i = 0; i < containerEvents.length; i++) {
      const e = containerEvents[i];
      if (e.handler !== null) {
        e.handler(e.event.data);
      }
    }
  }

  for (let i = 0; i < mouseInEvents.length; i++) {
    const e = mouseInEvents[i];
    if (e.handler !== null && e.handler(e.event.data)) {
      propagation = false;
      break;
    }
  }

  for (let i = 0; i < mouseOutEvents.length; i++) {
    const e = mouseOutEvents[i];
    if (e.handler !== null && e.handler(e.event.data)) {
      propagation = false;
      break;
    }
  }

  // free events
  UI3DEventQueueSchema.free(events);
  UI3DEventQueueSchema.free(containerEvents);
  UI3DEventQueueSchema.free(mouseInEvents);
  UI3DEventQueueSchema.free(mouseOutEvents);

  prevMouseState = mouseState;
  prevMouseButton = mouseButton;
  return propagation;
}
