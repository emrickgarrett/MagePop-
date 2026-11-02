import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Content Security Policy for release builds (dev needs inline scripts for hot reload, so it's
 * build-only). The game loads nothing from the internet except the PVP WebSocket server.
 */
function csp(pvpServer: string): Plugin {
  const policy = [
    "default-src 'self' file:",
    "script-src 'self' file:",
    // React sets inline style attributes; no inline <script> is allowed.
    "style-src 'self' file: 'unsafe-inline'",
    "img-src 'self' file: data: blob:",
    // Vite inlines small font subsets as data: URIs.
    "font-src 'self' file: data:",
    "media-src 'self' file: blob:",
    // The WebSocket, plus the same host over http(s) for the lobby's wake-up ping.
    `connect-src 'self' file: ${pvpServer} ${pvpServer.replace(/^ws(s?):/, 'http$1:')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'magepop-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

// base './' so the build works when Electron loads it from file://
/** The one place the online server address lives. Override with VITE_PVP_SERVER (e.g. a staging server). */
const RELEASE_PVP_SERVER = 'wss://magepop-server.fly.dev';
const DEV_PVP_SERVER = 'ws://localhost:8787';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const pvpServer = env.VITE_PVP_SERVER || (command === 'serve' ? DEV_PVP_SERVER : RELEASE_PVP_SERVER);
  return {
    base: './',
    plugins: [react(), csp(pvpServer)],
    define: {
      __PVP_SERVER__: JSON.stringify(pvpServer),
      // Version label for browser builds (desktop builds ask Electron instead). Set by the itch release job.
      __WEB_VERSION__: JSON.stringify(env.VITE_WEB_VERSION || ''),
    },
    server: { port: 5173, strictPort: true },
  };
});
