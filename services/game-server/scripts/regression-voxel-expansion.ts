import assert from 'node:assert/strict';
import { allocVoxels, freeVoxels, type VoxelView } from '@box/utils/voxel';
import {
  expandVoxelMap,
  validateVoxelExpansionShape,
} from '../src/voxel/voxel-expansion';

const source = allocVoxels(16, 16, 16);
let expanded: VoxelView | undefined;
try {
  source.fill(0);
  source.setVoxel(0, 0, 0, 7);
  source.setVoxel(15, 15, 15, 9);
  expanded = expandVoxelMap(source, [32, 32, 32]);

  assert.deepEqual(expanded.shape, [32, 32, 32]);
  assert.equal(expanded.getVoxel(0, 0, 0), 7);
  assert.equal(expanded.getVoxel(15, 15, 15), 9);
  assert.equal(expanded.getVoxel(16, 16, 16), 0);
  assert.throws(() => validateVoxelExpansionShape([16, 16, 16], [16, 16, 16]));
  assert.throws(() => validateVoxelExpansionShape([16, 16, 16], [16, 32, 15]));
  assert.throws(() => validateVoxelExpansionShape([16, 16, 16], [16, 144, 16]));
} finally {
  if (expanded) freeVoxels(expanded);
  freeVoxels(source);
}

console.log('voxel expansion regression checks passed');
