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

/**
 * Prefer a source-bearing XHS page over a login shell while preserving the
 * browser's order within each class. Target metadata is only a routing hint;
 * the status command still verifies readable content in the selected DOM.
 *
 * @param {unknown[]} tabs
 * @returns {Record<string, unknown> | null}
 */
export function selectXhsCdpTab(tabs) {
  if (!Array.isArray(tabs)) return null;

  return (
    tabs
      .flatMap((tab, index) => {
        if (!tab || typeof tab !== "object" || Array.isArray(tab)) return [];
        const candidate = /** @type {Record<string, unknown>} */ (tab);
        if (candidate.type !== "page" || typeof candidate.url !== "string") {
          return [];
        }
        let url;
        try {
          url = new URL(candidate.url);
        } catch {
          return [];
        }
        if (
          url.protocol !== "https:" ||
          (url.hostname !== "xiaohongshu.com" &&
            !url.hostname.endsWith(".xiaohongshu.com"))
        ) {
          return [];
        }
        const priority =
          url.pathname === "/explore" ||
          url.pathname.startsWith("/search_result")
            ? 3
            : url.pathname.startsWith("/user/profile/")
              ? 2
              : url.pathname === "/login"
                ? 0
                : 1;
        return [{ tab: candidate, index, priority }];
      })
      .sort((left, right) =>
        right.priority === left.priority
          ? left.index - right.index
          : right.priority - left.priority,
      )[0]?.tab ?? null
  );
}
