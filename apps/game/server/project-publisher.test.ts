import { useState } from 'react';
import { apiClient } from '../src/apis/client';
import { useProjectPublisher } from '../components/project-management/workflows/use-project-publisher';
import type { LocalProject } from '../components/project-management/project-types';

jest.mock('react', () => ({ useState: jest.fn() }));
jest.mock('../src/apis/client', () => ({
  apiClient: {
    getApiLocalProjectsAssetDistribution: jest.fn(),
    postApiLocalProjectsIdPublish: jest.fn(),
    postApiLocalProjectsIdPackageRaw: jest.fn(),
  },
}));

// Keep the hook's state setters functional while exercising its async API boundary.
let states: unknown[];
let stateIndex: number;
const project = {
  id: 'town',
  name: '测试地图',
  mainProjectId: 'town',
  latestRelease: 'v1.2.3',
} as LocalProject;
const options = {
  projects: [project],
  refreshProjects: jest.fn(async () => {}),
  setNotice: jest.fn(),
  closeProjectMenu: jest.fn(),
  selectProject: jest.fn(),
  openPublishDialog: jest.fn(),
  closeDialog: jest.fn(),
  setDialogError: jest.fn(),
  isSubmitting: () => false,
};
const originalWindow = globalThis.window;

beforeEach(() => {
  jest.clearAllMocks();
  states = [];
  stateIndex = 0;
  jest.mocked(useState).mockImplementation((initial: unknown = undefined) => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = initial;
    return [
      states[index],
      (next: unknown) => {
        states[index] = typeof next === 'function' ? next(states[index]) : next;
      },
    ] as ReturnType<typeof useState>;
  });
  globalThis.window = {
    setInterval: jest.fn(() => 1),
    clearInterval: jest.fn(),
    setTimeout: jest.fn(() => 2),
    clearTimeout: jest.fn(),
  } as unknown as Window & typeof globalThis;
  jest
    .mocked(apiClient.getApiLocalProjectsAssetDistribution)
    .mockResolvedValue({ configuration: {} } as never);
});

afterEach(() => {
  globalThis.window = originalWindow;
});

function renderHook() {
  stateIndex = 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useState is controlled by the test harness.
  return useProjectPublisher(options);
}

test('suggests a fresh release version when opening the publish dialog', () => {
  const publisher = renderHook();
  publisher.open(project);
  expect(renderHook().releaseVersion).toBe('v1.2.4');
  expect(options.selectProject).toHaveBeenCalledWith(project);
  expect(options.openPublishDialog).toHaveBeenCalledTimes(1);
});

test('a rejected release stops before exporting any older package', async () => {
  const publisher = renderHook();
  const rejection = new Error('Release already exists');
  jest
    .mocked(apiClient.postApiLocalProjectsIdPublish)
    .mockRejectedValue(rejection);
  await publisher.publish(project);
  expect(apiClient.postApiLocalProjectsIdPublish).toHaveBeenCalledWith({
    params: { path: { id: 'town' } },
    body: { version: 'v1.0.0', notes: '' },
  });
  expect(apiClient.postApiLocalProjectsIdPackageRaw).not.toHaveBeenCalled();
  expect(renderHook().publishProgress).toMatchObject({
    phase: 'error',
    message: rejection.message,
  });
  expect(options.refreshProjects).not.toHaveBeenCalled();
  expect(window.clearInterval).toHaveBeenCalledWith(1);
  expect(window.clearTimeout).toHaveBeenCalledWith(2);
});
