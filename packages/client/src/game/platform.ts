/** Thin wrapper over the Electron preload bridge. In a plain browser these features are unavailable. */
interface DesktopBridge {
  desktop: true;
  platform: string;
  quit: () => void;
  setFullscreen: (on: boolean) => void;
  isFullscreen: () => Promise<boolean>;
  version?: () => Promise<string>;
  update?: {
    get: () => Promise<UpdateState>;
    onChange: (cb: (s: UpdateState) => void) => () => void;
    install: () => void;
    openPage: () => void;
  };
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string } // can't self-update: offer the download page
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string };

const bridge = (window as unknown as { magepop?: DesktopBridge }).magepop;

export const isDesktop = !!bridge?.desktop;

export function quitApp() {
  bridge?.quit();
}

export async function setFullscreen(on: boolean) {
  if (bridge) bridge.setFullscreen(on);
  else if (on) await document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
}

export async function isFullscreen(): Promise<boolean> {
  if (bridge) return bridge.isFullscreen();
  return !!document.fullscreenElement;
}

export const appVersion = (): Promise<string | null> => bridge?.version?.() ?? Promise.resolve(null);

export const updater = {
  get: (): Promise<UpdateState> => bridge?.update?.get() ?? Promise.resolve({ status: 'idle' }),
  onChange: (cb: (s: UpdateState) => void) => bridge?.update?.onChange(cb) ?? (() => {}),
  install: () => bridge?.update?.install(),
  openPage: () => bridge?.update?.openPage(),
};
