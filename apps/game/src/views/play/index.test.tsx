declare const jest: typeof import('@jest/globals').jest;
import { beforeEach, expect, test } from '@jest/globals';
import PlayRoot from './index';
import { messenger } from '../../messenger';
import { PlayClient } from '../../client/play/play-client';

const effects: Array<() => void | (() => void)> = [];
const dispose = jest.fn();
const setPlayer = jest.fn();
jest.mock('react', () => ({
  ...(jest.requireActual('react') as typeof import('react')),
  memo: (component: unknown) => component,
  useState: () => [undefined, setPlayer],
  useRef: (current: unknown) => ({current}),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
}));
jest.mock('react-redux', () => ({Provider: () => null, useDispatch: () => jest.fn()}));
jest.mock('react-intl', () => ({useIntl: () => ({locale:'zh'})}));
jest.mock('../../utils/mobile', () => ({setHtmlFont: () => {}}));
jest.mock('../../utils/i18n', () => ({resolve_intl: () => {}}));
jest.mock('./container', () => ({MainPage: () => null}));
jest.mock('../../redux/play', () => ({store: {}}));
jest.mock('../../redux/slices/user', () => ({setUserInfo: () => ({})}));
jest.mock('../../client/play/play-context', () => ({PlayProvider: () => null}));
jest.mock('../../client/play/play-client', () => ({PlayClient: jest.fn(() => ({dispose}))}));
jest.mock('../../messenger', () => ({messenger: {connect: jest.fn()}}));

function mount() {
  const root = PlayRoot({userInfo:null,setLoadingStage:jest.fn(),setLocale:jest.fn()});
  const child = root.props.children;
  child.type(child.props);
  return effects[0]() as () => void;
}
beforeEach(() => {
  effects.length = 0;
  jest.clearAllMocks();
  (globalThis as any).window = {};
});
test('leaving the play page releases the engine instead of leaving its body-mounted canvas and socket active', async () => {
  jest.mocked(messenger.connect).mockResolvedValue(undefined);
  const unmount = mount();
  await Promise.resolve();
  expect(PlayClient).toHaveBeenCalledTimes(1);
  unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
});
test('leaving while messaging initializes cannot create an engine after the page is gone', async () => {
  let finish!: () => void;
  jest.mocked(messenger.connect).mockReturnValue(new Promise<void>(resolve => {finish=resolve}));
  const unmount = mount();
  unmount();
  finish();
  await Promise.resolve();
  expect(PlayClient).not.toHaveBeenCalled();
  expect(setPlayer).not.toHaveBeenCalled();
});
