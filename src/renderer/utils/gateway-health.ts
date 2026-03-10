const DEFAULT_TIMEOUT_MS = 300_000
const DEFAULT_INTERVAL_MS = 1_200
const REQUEST_TIMEOUT_MS = 4_000

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Returns true if the gateway is reachable (any HTTP response received).
 * Only a network-level error (ECONNREFUSED, timeout, etc.) returns false.
 * We do NOT require a specific status code because:
 *  - /api/health and /health may return 404 (not implemented by all gateway versions)
 *  - / may return 403 when accessed without a token
 *  - Any HTTP response means the TCP port is open and the server is ready
 */
async function isGatewayReachable(url: string): Promise<boolean> {
  try {
    await fetchWithTimeout(url, REQUEST_TIMEOUT_MS)
    return true
  } catch {
    return false
  }
}

export async function waitForGatewayReady(
  port: number,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const deadline = Date.now() + timeoutMs
  const endpoints = [
    `http://127.0.0.1:${port}/api/health`,
    `http://127.0.0.1:${port}/health`,
    `http://127.0.0.1:${port}/`,
  ]

  while (Date.now() < deadline) {
    for (const endpoint of endpoints) {
      if (await isGatewayReachable(endpoint)) {
        return true
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return false
}
