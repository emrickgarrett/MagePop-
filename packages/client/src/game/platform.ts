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

declare const __WEB_VERSION__: string;
const WEB_VERSION = typeof __WEB_VERSION__ === 'string' ? __WEB_VERSION__ : '';

/**
 * Corner tag label: "v1.2.3" in releases, the git branch in a local desktop checkout. Browser builds
 * show the version they were built for (itch release job), or nothing.
 */
export const appVersion = (): Promise<string | null> =>
  bridge?.version?.() ?? Promise.resolve(WEB_VERSION ? `v${WEB_VERSION.replace(/^v/, '')}` : null);

export const updater = {
  get: (): Promise<UpdateState> => bridge?.update?.get() ?? Promise.resolve({ status: 'idle' }),
  onChange: (cb: (s: UpdateState) => void) => bridge?.update?.onChange(cb) ?? (() => {}),
  install: () => bridge?.update?.install(),
  openPage: () => bridge?.update?.openPage(),
};

/**
 * Browser builds run inside whatever space the page gives them (an itch.io embed, a small laptop
 * window). The UI is laid out for at least the desktop app's minimum window, so below that size the
 * whole page is zoomed out to fit instead of overflowing. The desktop app never needs this.
 */
const MIN_W = 1200;
const MIN_H = 760;

let zoom = 1;

/** The window size in the page's own CSS pixels (after the browser-build zoom above). */
export const viewport = () => ({ w: window.innerWidth / zoom, h: window.innerHeight / zoom });

export function fitToWindow() {
  if (isDesktop) return;
  const apply = () => {
    zoom = Number(Math.min(1, window.innerWidth / MIN_W, window.innerHeight / MIN_H).toFixed(4));
    document.documentElement.style.setProperty('zoom', zoom < 1 ? String(zoom) : '');
  };
  apply();
  window.addEventListener('resize', apply);
}
