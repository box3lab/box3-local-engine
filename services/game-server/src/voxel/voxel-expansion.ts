import { allocVoxels, freeVoxels, type VoxelView } from '@box/utils/voxel';

export type VoxelExpansionShape = [number, number, number];

export function validateVoxelExpansionShape(
  current: [number, number, number],
  target: VoxelExpansionShape,
) {
  const [nx, ny, nz] = target;
  const [oldX, oldY, oldZ] = current;
  if (
    !target.every(Number.isInteger) ||
    nx < oldX || ny < oldY || nz < oldZ ||
    (nx === oldX && ny === oldY && nz === oldZ)
  ) {
    throw new Error('新地图尺寸必须是有效整数，且每个方向均不得小于原地图。');
  }
  if (
    nx < 16 || nx > 1024 ||
    ny < 16 || ny > 128 ||
    nz < 16 || nz > 1024 ||
    nx % 16 !== 0 || ny % 16 !== 0 || nz % 16 !== 0 ||
    nx * ny * nz > 1024 * 128 * 1024
  ) {
    throw new Error('宽、长需为 16–1024，高需为 16–128，且均为 16 的倍数；地图体素总量不能超过支持上限。');
  }
}

export function expandVoxelMap(
  voxels: VoxelView,
  target: VoxelExpansionShape,
): VoxelView {
  const [oldX, oldY, oldZ] = voxels.shape;
  validateVoxelExpansionShape(voxels.shape, target);
  const [nx, ny, nz] = target;
  const expanded = allocVoxels(nx, ny, nz);
  try {
    expanded.fill(0);
    expanded.slice([0, 0, 0], [oldX, oldY, oldZ]).copy(voxels);
    return expanded;
  } catch (error) {
    freeVoxels(expanded);
    throw error;
  }
}
