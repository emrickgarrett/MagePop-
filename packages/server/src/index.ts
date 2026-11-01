/**
 * MagePop PVP server entry point. Configuration comes from the environment (nothing secret lives
 * in this repo):
 *   PORT                  listen port (default 8787)
 *   TRUSTED_IP_HEADER     header with the real client IP when behind a trusted proxy
 *                         (set to "fly-client-ip" on Fly.io; leave unset anywhere else)
 *   MAX_CONNECTIONS, MAX_CONNECTIONS_PER_IP   optional overrides
 */
import { PvpServer } from './server';

const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

const server = new PvpServer({
  port: num(process.env.PORT) ?? 8787,
  trustedIpHeader: process.env.TRUSTED_IP_HEADER || undefined,
  ...(num(process.env.MAX_CONNECTIONS) ? { maxConnections: num(process.env.MAX_CONNECTIONS)! } : {}),
  ...(num(process.env.MAX_CONNECTIONS_PER_IP) ? { maxConnectionsPerIp: num(process.env.MAX_CONNECTIONS_PER_IP)! } : {}),
});

server.listen().then((port) => console.log(`MagePop PVP server listening on :${port}`));

// Deploys send SIGTERM: tell players, end matches cleanly, then exit.
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`${sig}: shutting down`);
    server.close().finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
