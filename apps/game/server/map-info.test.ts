jest.mock('../configs/server', () => ({
  getServerConfig: jest.fn(async () => ({ isLocalGameServer: true })),
}));

jest.mock('./logger', () => ({
  getSharedLogger: jest.fn(async () => ({ info: jest.fn() })),
}));

jest.mock('./play-worlds', () => ({
  findPlayWorld: jest.fn(() => undefined),
}));

jest.mock('./local-project-manager', () => ({
  getLocalProjectManager: jest.fn(() => ({
    getProject: jest.fn(() => ({
      id: 'project-new-map',
      name: 'New map',
    })),
  })),
}));

import { getMapContentInfo } from './map-info';
import { findPlayWorld } from './play-worlds';

describe('getMapContentInfo', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      BOX_DEPLOYMENT_MODE: 'creator',
      BOX_PLAY_LIBRARY_PATH: '/local/play-worlds',
    };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  test('loads a creator project without requiring it to be a published play world', async () => {
    await expect(
      getMapContentInfo('edit', 'project-new-map', ''),
    ).resolves.toMatchObject({ name: 'New map' });

    expect(findPlayWorld).not.toHaveBeenCalled();
  });

  test('still rejects a play world that is absent from the local play library', async () => {
    await expect(
      getMapContentInfo('play', 'project-new-map', ''),
    ).rejects.toThrow('Play world does not exist: project-new-map');
  });
});
