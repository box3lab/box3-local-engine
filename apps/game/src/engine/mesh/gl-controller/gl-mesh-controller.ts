import { mat4, vec3 } from 'gl-matrix';
import REGL from 'regl';
import { unpackTextureData } from '@box/mesher';
import { ImageModel } from '@box/build-system/tasks/texture/img-process';

import {
  GLMesh,
  GLMeshSchema,
  GLMeshInstanceListSchema,
  GLMeshInstanceList,
  GLMeshInstanceSchema,
  GLTextureInstanceListSchema,
  GLTextureInstanceList,
  GLTextureInstanceSchema,
  GLMeshMotionMatrixSchema,
} from './gl-mesh-schema';
import {
  NodesInfoSchema,
  AnimationsSchema,
  NodesMatrixSchema,
} from '../parse/mesh-schema';

import { Frustum } from '@box/schema/utils/frustum-schema';
import { GameClientState } from '../../game-client-schema';
import { testFrustumBox } from '../../utils/frustum';
import { LightProbe } from '../../voxel/light-schema';
import { sampleLightBox } from '../../voxel/voxel-controller';
import {
  Vec3Schema,
  Mat4Schema,
  Vec2Schema,
} from '@box/schema/utils/math-schema';
import { GLState } from '../../gl/schema/gl-schema';
import { getQuadElements } from '../../gl/quad';
import { testChunkVisibility } from '../../voxel/voxel-controller';
import { GLTexture, GLTextureSchema } from '../../gl/schema/gl-texture';
import { setTextureData, ParsedPlayInfo } from '../parse/model-animation';
import { Meshes } from '../parse/mesh-controller';
import { alloc, free } from '../../utils/pool';
import {
  updateMeshInstanceMatrices,
  updateProbeGeometry,
} from '../parse/mesh-light';
import {
  MeshCache,
  MeshMotionMatrix,
  isGLMotionMatrix,
} from '../renderable-schema';
import { ceilPowerOfTwo } from '../util';

const MAT4_IDENTITY = mat4.identity(mat4.create());

export function createGLMesh(
  cache: MeshCache,
  regl: REGL.Regl,
  glState: GLState,
  hash: string,
  meshes: Meshes,
) {
  const result = GLMeshSchema.alloc();
  result.hash = hash;

  const {
    lox,
    loy,
    loz,
    hix,
    hiy,
    hiz,
    texture,
    meshData,
    uvData,
    count,
    idxData: optionalIdxData,
    nodesInfo: optionalNodesInfo,
    animations: optionalAnimations,
    staticIsTransparent = false,
    renderBoxOffset,
  } = meshes;

  result.staticIsTransparent = staticIsTransparent;

  const { width } = texture;
  const height = texture.data.length / width;

  const idxData = optionalIdxData || new Uint8Array(meshData.length / 4);
  const meshStride = 4;
  const idxStride = idxData instanceof Uint8Array ? 1 : 2;
  const uvStride = uvData instanceof Uint8Array ? 2 : 4;

  result.lox = lox;
  result.loy = loy;
  result.loz = loz;
  result.hix = hix;
  result.hiy = hiy;
  result.hiz = hiz;

  result.nodesInfo = NodesInfoSchema.clone(optionalNodesInfo || []);
  result.animations = AnimationsSchema.clone(optionalAnimations || []);
  result.staticNodesMatrix = [];

  vec3.copy(result.renderBoxOffset, renderBoxOffset);

  const elements = getQuadElements(glState, count);

  result.texture = regl.texture({
    data: unpackTextureData(texture, [24, 16, 8, 0]),
    width,
    height,
    wrap: 'clamp',
  });
  result.textureShape = [width, height];

  // 一个像素点记录四个数字，四个像素点一组记录一个mat4
  // nodesInfo.length个节点就起码需要 nodesInfo.length * 4个像素点记录偏移矩阵
  // 开方表示换算成size * size尺寸的图片
  let matrixSize = Math.sqrt(result.nodesInfo.length * 4);
  // size需要取2的次幂，4的倍数，保证16个数字信息在同一行里
  matrixSize = ceilPowerOfTwo(matrixSize);
  // 尺寸最小为4
  matrixSize = Math.max(matrixSize, 4);
  result.matrixTextureSize = matrixSize;

  // 透明度texture需要与节点数量相等的像素点
  let alphaSize = Math.sqrt(result.nodesInfo.length);
  alphaSize = ceilPowerOfTwo(alphaSize);
  alphaSize = Math.max(alphaSize, 2);
  result.alphaTextureSize = alphaSize;

  const useMatrixTexture = glState.reglLoader?.floatBuffer.type !== 'uint8';

  // 一个像素点4个数字，一共可记录 size * size * 4个数字
  const staticMatrixData = new Float32Array(matrixSize * matrixSize * 4);
  const staticAlphaData = new Uint8Array(alphaSize * alphaSize * 4);

  if (!result.nodesInfo.length) {
    staticMatrixData.set(MAT4_IDENTITY);
    staticAlphaData.fill(255);
  } else {
    setTextureData(
      {
        matrixData: useMatrixTexture
          ? staticMatrixData
          : result.staticNodesMatrix,
        alphaData: staticAlphaData,
      },
      result.nodesInfo,
    );
  }

  if (useMatrixTexture) {
    result.staticMatrixTexture = regl.texture({
      data: staticMatrixData,
      width: matrixSize,
      height: matrixSize,
    });
  } else {
    result.staticMatrixTexture = regl.texture();
  }

  result.staticAlphaTexture = regl.texture({
    data: staticAlphaData,
    width: alphaSize,
    height: alphaSize,
  });

  result.meshBuffer = regl.buffer(meshData);
  result.uvBuffer = regl.buffer(uvData);
  result.idxBuffer = regl.buffer(idxData);

  result.s0.buffer = result.meshBuffer;
  result.s0.offset = 0;
  result.s0.stride = meshStride;
  result.s0.size = 4;
  result.s0.divisor = 0;
  result.s0.normalize = false;

  result.s1.buffer = result.idxBuffer;
  result.s1.offset = 0;
  result.s1.stride = idxStride;
  result.s1.size = 1;
  result.s1.divisor = 0;
  result.s1.normalize = false;

  result.uv.buffer = result.uvBuffer;
  result.uv.offset = 0;
  result.uv.stride = uvStride;
  result.uv.size = 2;
  result.uv.divisor = 0;
  result.uv.normalize = false;

  result.vao = regl.vao({
    attributes: [result.s0, result.s1, result.uv],
    elements,
    count,
    offset: 0,
    instances: -1,
    primitive: 'triangles',
  });

  result.isGLTF = false;

  cache.modelIndex[hash] = result;
  cache.glCache.push(result);

  return result;
}

export function createGLTexture(
  state: GameClientState,
  cache: MeshCache,
  regl: REGL.Regl,
  hash: string,
  imgModel: ImageModel,
) {
  const result = GLTextureSchema.alloc();
  const req = state.content.fetchImage(imgModel.data);
  if (!req.loaded || !req.image) {
    return;
  }
  result.hashes = [imgModel.data];
  result.data = req.image;
  result.width = imgModel.width;
  result.height = imgModel.height;
  let textureData: HTMLImageElement | HTMLCanvasElement;
  if (result.data instanceof ImageBitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = result.data.width;
    canvas.height = result.data.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create a 2D context for the model texture');
    }
    context.drawImage(result.data, 0, 0);
    textureData = canvas;
  } else {
    textureData = result.data;
  }
  result.texture = regl.texture({ data: textureData });
  cache.imageIndex[hash] = result;
}

export function allocGLMeshList() {
  return GLMeshInstanceListSchema.clone(GLMeshInstanceListSchema.identity);
}

export function freeGLMeshList(pass: GLMeshInstanceList) {
  return GLMeshInstanceListSchema.free(pass);
}

export function allocGLTextureList() {
  return GLTextureInstanceListSchema.clone(
    GLTextureInstanceListSchema.identity,
  );
}

export function freeGLTextureList(pass: GLTextureInstanceList) {
  return GLTextureInstanceListSchema.free(pass);
}

export function pushGLTexture(
  pass: GLTextureInstanceList,
  model: mat4,
  glTexture: GLTexture,
) {
  const TI = GLTextureInstanceSchema.alloc();

  Mat4Schema.assign(TI.model, model);
  TI.texture = glTexture.texture;
  const x = glTexture.width / 2;
  const y = glTexture.height / 2;
  TI.vertex.length = 4;
  TI.vertex[0] = Vec3Schema.alloc();
  TI.vertex[1] = Vec3Schema.alloc();
  TI.vertex[2] = Vec3Schema.alloc();
  TI.vertex[3] = Vec3Schema.alloc();
  TI.vertex[0][0] = -x;
  TI.vertex[0][1] = y;
  TI.vertex[0][2] = 0;
  TI.vertex[1][0] = x;
  TI.vertex[1][1] = y;
  TI.vertex[1][2] = 0;
  TI.vertex[2][0] = x;
  TI.vertex[2][1] = -y;
  TI.vertex[2][2] = 0;
  TI.vertex[3][0] = -x;
  TI.vertex[3][1] = -y;
  TI.vertex[3][2] = 0;

  TI.uv.length = 4;
  TI.uv[0] = Vec2Schema.alloc();
  TI.uv[1] = Vec2Schema.alloc();
  TI.uv[2] = Vec2Schema.alloc();
  TI.uv[3] = Vec2Schema.alloc();
  TI.uv[0][0] = 0;
  TI.uv[0][1] = 0;
  TI.uv[1][0] = 1;
  TI.uv[1][1] = 0;
  TI.uv[2][0] = 1;
  TI.uv[2][1] = 1;
  TI.uv[3][0] = 0;
  TI.uv[3][1] = 1;

  pass.push(TI);
}

export function pushGLMesh(
  state: GameClientState,
  frustum: Frustum,
  pass: GLMeshInstanceList,
  id: number,
  model: mat4,
  part: GLMesh,
  red: number,
  green: number,
  blue: number,
  alpha: number,
  metalness: number,
  emissive: number,
  shiny: number,
  testFrustum: boolean,
  motionTexture?: {
    matrixTexture: REGL.Texture2D | null;
    alphaTexture: REGL.Texture2D | null;
    nodesMatrix: mat4[];
  },
) {
  // unpack matrix components
  const m0 = model[0];
  const m1 = model[1];
  const m2 = model[2];
  const m4 = model[4];
  const m5 = model[5];
  const m6 = model[6];
  const m8 = model[8];
  const m9 = model[9];
  const m10 = model[10];
  const m12 = model[12];
  const m13 = model[13];
  const m14 = model[14];

  // grab probe entry
  const probe: LightProbe = sampleLightBox(state.light, id);

  // update probe bounds
  const frameCount = state.frameCount;
  if (probe.lastGeomAccess !== frameCount) {
    probe.lastGeomAccess = state.frameCount;
    updateProbeGeometry(
      probe,
      part.lox,
      part.loy,
      part.loz,
      part.hix,
      part.hiy,
      part.hiz,
      m0,
      m1,
      m2,
      m4,
      m5,
      m6,
      m8,
      m9,
      m10,
      m12,
      m13,
      m14,
    );
  }

  // check frustum
  if (
    testFrustum &&
    !(
      testChunkVisibility(
        state,
        probe.lox,
        probe.loy,
        probe.loz,
        probe.hix,
        probe.hiy,
        probe.hiz,
      ) &&
      testFrustumBox(
        frustum,
        probe.lox,
        probe.loy,
        probe.loz,
        probe.hix,
        probe.hiy,
        probe.hiz,
      )
    )
  ) {
    return false;
  }

  // compute distance to camera
  const eyeX = state.camera.eye[0];
  const eyeY = state.camera.eye[1];
  const eyeZ = state.camera.eye[2];
  const distance = // use linfinity distance to bounding box
    Math.max(0, Math.max(probe.lox - eyeX, eyeX - probe.hix)) +
    Math.max(0, Math.max(probe.loy - eyeY, eyeY - probe.hiy)) +
    Math.max(0, Math.max(probe.loz - eyeZ, eyeZ - probe.hiz));
  const passId = state.modelInfo.passId;
  if (part.passId !== passId) {
    part.passId = passId;
    part.distance = distance;
  } else {
    part.distance = Math.min(part.distance, distance);
  }

  // copy data into mesh instance
  const meshInstance = GLMeshInstanceSchema.alloc();
  meshInstance.id = id;
  updateMeshInstanceMatrices(
    meshInstance,
    m0,
    m1,
    m2,
    m4,
    m5,
    m6,
    m8,
    m9,
    m10,
    m12,
    m13,
    m14,
  );
  meshInstance.part = part;
  meshInstance.ambient = probe;
  meshInstance.distance = distance;
  meshInstance.red = red;
  meshInstance.green = green;
  meshInstance.blue = blue;
  meshInstance.alpha = alpha;
  meshInstance.metalness = metalness;
  meshInstance.shininess = shiny;
  meshInstance.emissive = emissive;
  meshInstance.matrixTexture =
    motionTexture?.matrixTexture || part.staticMatrixTexture;
  meshInstance.alphaTexture =
    motionTexture?.alphaTexture || part.staticAlphaTexture;
  meshInstance.nodesMatrix = NodesMatrixSchema.clone(
    motionTexture?.nodesMatrix || part.staticNodesMatrix,
  );
  pass.push(meshInstance);
  return true;
}

export function setMotionTexture<
  T extends {
    motionMatrix: MeshMotionMatrix | null;
  },
>(
  out: T,
  state: GameClientState,
  glMesh: GLMesh,
  parsedPlayInfo: ParsedPlayInfo,
) {
  const regl = state.gl.regl;
  if (!regl) {
    return;
  }
  if (!isGLMotionMatrix(out.motionMatrix)) {
    out.motionMatrix = GLMeshMotionMatrixSchema.alloc();
  }

  const matrixSize = glMesh.matrixTextureSize;
  const alphaSize = glMesh.alphaTextureSize;

  const matrixTextureData = new Float32Array(
    alloc(matrixSize * matrixSize * 4 * 4),
  );
  const alphaTextureData = new Uint8Array(alloc(alphaSize * alphaSize * 4));

  const useMatrixTexture = state.gl.reglLoader?.floatBuffer.type !== 'uint8';
  out.motionMatrix.nodesMatrix = [];

  setTextureData(
    {
      matrixData: useMatrixTexture
        ? matrixTextureData
        : out.motionMatrix.nodesMatrix,
      alphaData: alphaTextureData,
    },
    glMesh.nodesInfo,
    parsedPlayInfo,
  );

  if (useMatrixTexture) {
    if (!out.motionMatrix.matrixTexture) {
      out.motionMatrix.matrixTexture = regl.texture({
        data: matrixTextureData,
        width: matrixSize,
        height: matrixSize,
      });
    } else {
      out.motionMatrix.matrixTexture({
        data: matrixTextureData,
        width: matrixSize,
        height: matrixSize,
      });
    }
  }

  if (!out.motionMatrix.alphaTexture) {
    out.motionMatrix.alphaTexture = regl.texture({
      data: alphaTextureData,
      width: alphaSize,
      height: alphaSize,
    });
  } else {
    out.motionMatrix.alphaTexture({
      data: alphaTextureData,
      width: alphaSize,
      height: alphaSize,
    });
  }

  free(matrixTextureData.buffer);
  free(alphaTextureData.buffer);
}
