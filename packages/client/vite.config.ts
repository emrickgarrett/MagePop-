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
    "media-src 'self' file: blob:",
    `connect-src 'self' file: ${pvpServer}`,
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
    define: { __PVP_SERVER__: JSON.stringify(pvpServer) },
    server: { port: 5173, strictPort: true },
  };
});
