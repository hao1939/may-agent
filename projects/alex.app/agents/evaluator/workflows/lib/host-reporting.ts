/** Reporting and Task control must address the same Host installation. */
export function hostReportUrl(path: string): URL {
  return new URL(
    path,
    process.env.MAY_REPORT_BASE_URL?.trim() || "http://localhost:8080",
  );
}

/** Shared transport only; each evidence reader owns its contract checks. */
export async function readHostReport(
  url: URL,
  options: { timeoutMs: number; maxBytes: number; signal?: AbortSignal },
  request: (url: URL, options: RequestInit) => Promise<Response> = fetch,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  signal.throwIfAborted();
  const response = await request(url, { signal, redirect: "error" });
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    signal.throwIfAborted();
    throw new Error(
      `Host report ${url.pathname} unavailable (HTTP ${response.status})`,
    );
  }
  const reader = response.body.getReader();
  let result: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > options.maxBytes)
        throw new Error(
          `Host report ${url.pathname} exceeds ${options.maxBytes} byte limit`,
        );
      chunks.push(value);
    }
    result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    // Cleanup must not hide an unavailable, oversized or cancelled read.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  signal.throwIfAborted();
  return result;
}
