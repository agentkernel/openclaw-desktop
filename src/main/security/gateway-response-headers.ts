export const LOOPBACK_GATEWAY_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

// Chromium rejects `http://[::1]:*` in CSP; localhost + 127.0.0.1 cover typical loopback.
export const RELAXED_GATEWAY_FRAME_ANCESTORS =
  "frame-ancestors 'self' file: openclaw-shell://renderer http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*"

export type GatewayResponseHeadersInput = Record<string, string[] | string | undefined>
export type GatewayResponseHeaders = Record<string, string[]>

export function isLoopbackGatewayResponseUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }
    const normalizedHost = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
    return LOOPBACK_GATEWAY_HOSTS.has(normalizedHost)
  } catch {
    return false
  }
}

export function relaxGatewayFrameAncestors(csp: string): string {
  if (/frame-ancestors\s+[^;]+/i.test(csp)) {
    return csp.replace(/frame-ancestors\s+[^;]+/i, RELAXED_GATEWAY_FRAME_ANCESTORS)
  }

  const trimmed = csp.trim()
  if (!trimmed) {
    return RELAXED_GATEWAY_FRAME_ANCESTORS
  }

  return `${trimmed}${trimmed.endsWith(';') ? '' : ';'} ${RELAXED_GATEWAY_FRAME_ANCESTORS}`
}

/**
 * Some gateway builds use `default-src 'none'` with `frame-ancestors 'none'`. After we relax
 * frame-ancestors for the Electron shell iframe, `default-src 'none'` can still block the Control UI
 * bundle (no script), WebSocket (no connect-src), or CSS — resulting in a blank white iframe.
 */
export function mitigateStrictGatewayDefaultSrc(csp: string): string {
  if (!/\bdefault-src\s+'none'/i.test(csp)) {
    return csp
  }
  const hasScriptSrc = /\bscript-src\b/i.test(csp)
  if (!hasScriptSrc) {
    return csp.replace(/\bdefault-src\s+'none'/gi, "default-src 'self'")
  }

  const extras: string[] = []
  if (!/\bconnect-src\b/i.test(csp)) {
    extras.push("connect-src 'self'")
  }
  if (!/\bstyle-src\b/i.test(csp)) {
    extras.push("style-src 'self' 'unsafe-inline'")
  }
  if (!/\bimg-src\b/i.test(csp)) {
    extras.push("img-src 'self' data: blob:")
  }
  if (!/\bfont-src\b/i.test(csp)) {
    extras.push("font-src 'self' data:")
  }
  if (!/\bworker-src\b/i.test(csp)) {
    extras.push("worker-src 'self' blob:")
  }
  if (extras.length === 0) {
    return csp
  }
  const trimmed = csp.trim()
  const sep = trimmed.endsWith(';') || trimmed === '' ? ' ' : '; '
  return `${trimmed}${sep}${extras.join('; ')}`
}

function polishGatewayCspForDesktopEmbed(csp: string): string {
  return mitigateStrictGatewayDefaultSrc(relaxGatewayFrameAncestors(csp))
}

export function patchGatewayResponseHeaders(
  rawUrl: string,
  responseHeaders: GatewayResponseHeadersInput | undefined,
): GatewayResponseHeaders | null {
  if (!isLoopbackGatewayResponseUrl(rawUrl)) {
    return null
  }

  const headers: GatewayResponseHeaders = {}
  for (const [key, value] of Object.entries(responseHeaders ?? {})) {
    if (Array.isArray(value)) {
      headers[key] = value.map((item) => String(item))
    } else if (value !== undefined) {
      headers[key] = [String(value)]
    }
  }
  const headerKeys = Object.keys(headers)

  for (const key of headerKeys) {
    if (key.toLowerCase() === 'x-frame-options') {
      delete headers[key]
    }
  }

  const cspKey = headerKeys.find((key) => key.toLowerCase() === 'content-security-policy')
  if (cspKey) {
    const cspRaw = headers[cspKey]
    if (Array.isArray(cspRaw)) {
      headers[cspKey] = cspRaw.map((v) => polishGatewayCspForDesktopEmbed(String(v)))
    } else if (cspRaw) {
      headers[cspKey] = [polishGatewayCspForDesktopEmbed(String(cspRaw))]
    } else {
      headers[cspKey] = [RELAXED_GATEWAY_FRAME_ANCESTORS]
    }
  } else {
    headers['Content-Security-Policy'] = [RELAXED_GATEWAY_FRAME_ANCESTORS]
  }

  return headers
}
