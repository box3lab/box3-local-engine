import type { GroupEntry } from '@box/rewgpu';
import { GameClientState } from '../game-client-schema';

/**
 * 可被缓存的非资源数据
 */
export interface CommonUniformLayout {
  structCode: string;
  commonGroupLayoutEntries: GPUBindGroupLayoutEntry[];
  commonGroupLayout: GPUBindGroupLayout;
  oitGroupLayoutEntries: GPUBindGroupLayoutEntry[];
  oitGroupLayout: GPUBindGroupLayout;
}

/**
 * 需要跟随gpu.clear销毁的资源数据
 */
export interface CommonUniformEntries {
  entries: GroupEntry[];
  getOITEntries: (state: GameClientState) => GroupEntry[];
}

export type CommonUniforms = CommonUniformLayout & CommonUniformEntries;
