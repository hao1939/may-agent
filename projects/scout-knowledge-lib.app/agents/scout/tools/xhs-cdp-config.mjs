const DEFAULT_CDP_HOST = "localhost";
const DEFAULT_CDP_PORT = 9222;

/**
 * Resolve the observational Chrome DevTools endpoint without embedding
 * deployment-specific host wiring in the XHS browser adapter.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ host: string, port: number }}
 */
export function resolveXhsCdpEndpoint(env = process.env) {
  const host = (env.SCOUT_XHS_CDP_HOST ?? DEFAULT_CDP_HOST).trim();
  if (!host || /[\s/?#@]/.test(host)) {
    throw new Error(
      "SCOUT_XHS_CDP_HOST must be a hostname or IP address without a URL scheme",
    );
  }

  const rawPort = (env.SCOUT_XHS_CDP_PORT ?? String(DEFAULT_CDP_PORT)).trim();
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SCOUT_XHS_CDP_PORT must be an integer from 1 to 65535");
  }

  return { host, port };
}
