import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, test } from '@jest/globals';
import { BitArray } from '@box/build-system/utils/bitarray';
import * as bloomFilter from '@box/build-system/utils/bloom-filter';

function randomString(len: number, seed: number) {
  let s = '';
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    s += String.fromCharCode(33 + (seed % 94));
  }
  return s;
}

describe('bloom-filter', () => {
  test('bloom-filter not failed', function () {
    const pwds = fs
      .readFileSync(
        path.join(__dirname, '../../../scripts/assets/weak_passwords.txt'),
      )
      .toString()
      .split('\n')
      .filter((s) => s);
    const bitArray = new BitArray();
    const build = bloomFilter.createBuilder(
      bitArray,
      pwds.length,
      1 / pwds.length,
    );
    for (const pwd of pwds) {
      build(pwd);
    }
    const filter = bloomFilter.createFilter(bitArray);
    expect(pwds.every(filter)).toBe(true);
    const passwords = new Set(pwds);
    const absent = Array.from({ length: pwds.length }, (_, i) =>
      randomString(16, i),
    );
    const falsePositives = absent.filter(
      (password) => !passwords.has(password) && filter(password),
    );
    expect(falsePositives.length).toBeLessThan(10);
  });
});
