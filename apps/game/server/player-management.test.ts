import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from '@jest/globals';

import type { PlayerAccountView } from './local-player-identity';
import {
  createRuntimeIdentityAssertion,
  limitsSessionsToSingleDevice,
  serializeManagedPlayersCsv,
} from './local-player-identity';

const identitySource = fs.readFileSync(
  path.resolve(__dirname, 'local-player-identity.ts'),
  'utf8',
);

function player(changes: Partial<PlayerAccountView> = {}): PlayerAccountView {
  return {
    subjectId: '0123456789abcdef0123456789abcdef',
    userId: '42',
    username: 'player_42',
    boxId: '',
    displayName: '玩家四十二',
    avatarSkinId: 'explorer',
    creatorAccess: false,
    creatorPermissions: [],
    role: 'player',
    status: 'active',
    guest: false,
    userKey: 'local:0123456789abcdef0123456789abcdef',
    firstSeenIp: '127.0.0.1',
    lastSeenIp: '127.0.0.1',
    registrationIp: '127.0.0.1',
    lastLoginIp: '127.0.0.1',
    loginCount: 3,
    activeSessionCount: 1,
    activeCreatorTokenCount: 0,
    adminNote: '',
    tags: [],
    banReason: '',
    adminPermissions: [],
    ...changes,
  };
}

describe('player management CSV export', () => {
  test('keeps Chinese data and escapes commas, quotes and newlines', () => {
    const csv = serializeManagedPlayersCsv([player({
      displayName: '冷鱼,测试',
      adminNote: '第一行\n"第二行"',
      tags: ['测试员', '重点关注'],
    })]);

    expect(csv.startsWith('\uFEFF用户ID,身份ID')).toBe(true);
    expect(csv).toContain('"冷鱼,测试"');
    expect(csv).toContain('测试员|重点关注');
    expect(csv).toContain('"第一行\n""第二行"""');
  });

  test('neutralizes spreadsheet formulas from player-controlled fields', () => {
    const csv = serializeManagedPlayersCsv([player({
      displayName: '=HYPERLINK("https://example.invalid")',
      adminNote: '+cmd',
      tags: ['@danger'],
    })]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@danger");
    expect(csv).toContain("'+cmd");
  });

  test('exports the optional legacy Box ID independently from the local username', () => {
    const csv = serializeManagedPlayersCsv([player({
      username: 'local_player',
      boxId: 'legacy_box_player',
    })]);

    expect(csv).toContain('神岛ID');
    expect(csv).toContain('local_player,legacy_box_player');
  });
});

describe('player session policy', () => {
  test('limits every legacy player role to one device because management accounts are separate', () => {
    expect(limitsSessionsToSingleDevice('player')).toBe(true);
    expect(limitsSessionsToSingleDevice('moderator')).toBe(true);
    expect(limitsSessionsToSingleDevice('admin')).toBe(true);
  });
});

describe('player profile persistence', () => {
  test('keeps runtime identity assertions valid after saving an uploaded avatar', () => {
    const previousSecret = process.env.PERMISSION_TOKEN_SECRET;
    process.env.PERMISSION_TOKEN_SECRET = 'test-runtime-identity-secret';
    try {
      expect(() => createRuntimeIdentityAssertion({
        subjectId: '0123456789abcdef0123456789abcdef',
        userId: '42',
        username: 'player_42',
        boxId: '',
        displayName: '玩家四十二',
        avatar: `data:image/png;base64,${'a'.repeat(3000)}`,
        avatarSkinId: 'explorer',
        creatorAccess: false,
        creatorPermissions: [],
        role: 'player',
        status: 'active',
        userKey: 'local:0123456789abcdef0123456789abcdef',
        expiresAt: Date.now() + 60_000,
      })).not.toThrow();
    } finally {
      if (previousSecret === undefined) delete process.env.PERMISSION_TOKEN_SECRET;
      else process.env.PERMISSION_TOKEN_SECRET = previousSecret;
    }
  });

  test('does not return derived identity fields directly from the users table', () => {
    const profileUpdate = identitySource.slice(
      identitySource.indexOf('export async function updateCurrentPlayerProfile'),
      identitySource.indexOf('export async function updatePlayerMapLibrary'),
    );

    expect(profileUpdate).toContain('created_at AS registered_at');
    expect(profileUpdate).not.toContain('updated_at, registered_at, last_seen_at');
    expect(profileUpdate).toContain('JOIN updated u ON u.principal_id = p.id');
  });
});
