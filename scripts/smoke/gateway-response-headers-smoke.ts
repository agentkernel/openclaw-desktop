import assert from 'node:assert/strict'
import {
  RELAXED_GATEWAY_FRAME_ANCESTORS,
  isLoopbackGatewayResponseUrl,
  mitigateStrictGatewayDefaultSrc,
  patchGatewayResponseHeaders,
  relaxGatewayFrameAncestors,
} from '../../src/main/security/gateway-response-headers.ts'
import { rewriteGatewayRequestUrlWithToken } from '../../src/main/security/gateway-request-auth.ts'

function testLoopbackUrlRecognition(): void {
  assert.equal(isLoopbackGatewayResponseUrl('http://127.0.0.1:8080/health'), true)
  assert.equal(isLoopbackGatewayResponseUrl('http://localhost:3000/'), true)
  assert.equal(isLoopbackGatewayResponseUrl('https://localhost:3443/path'), true)
  assert.equal(isLoopbackGatewayResponseUrl('http://[::1]:5173/'), true)

  assert.equal(isLoopbackGatewayResponseUrl('http://192.168.1.2:5173/'), false)
  assert.equal(isLoopbackGatewayResponseUrl('https://example.com/'), false)
  assert.equal(isLoopbackGatewayResponseUrl('file:///index.html'), false)
  assert.equal(isLoopbackGatewayResponseUrl('not-a-url'), false)
}

function testFrameAncestorsRelaxation(): void {
  const replaced = relaxGatewayFrameAncestors("default-src 'self'; frame-ancestors 'none'; script-src 'self'")
  assert.match(replaced, /default-src 'self';/)
  assert.match(replaced, /script-src 'self'/)
  assert.match(replaced, /frame-ancestors 'self' file:.*http:\/\/localhost:\*/)

  const appended = relaxGatewayFrameAncestors("default-src 'self'")
  assert.equal(
    appended,
    "default-src 'self'; frame-ancestors 'self' file: openclaw-shell://renderer http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*",
  )

  const fromEmpty = relaxGatewayFrameAncestors('')
  assert.equal(fromEmpty, RELAXED_GATEWAY_FRAME_ANCESTORS)
}

function testHeaderPatchForLoopbackResponse(): void {
  const patched = patchGatewayResponseHeaders('http://localhost:8080/ui', {
    'X-Frame-Options': ['DENY'],
    'Content-Security-Policy': ["default-src 'self'; frame-ancestors 'none'"],
    Server: ['openclaw'],
  })

  assert.ok(patched, 'expected loopback headers to be patched')
  assert.equal((patched as Record<string, unknown>)['X-Frame-Options'], undefined)
  assert.equal(
    patched?.['Content-Security-Policy']?.[0],
    "default-src 'self'; frame-ancestors 'self' file: openclaw-shell://renderer http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*",
  )
  assert.deepEqual(patched?.Server, ['openclaw'])
}

function testMitigateDefaultSrcNone(): void {
  const relaxed = relaxGatewayFrameAncestors("default-src 'none'; frame-ancestors 'none'")
  const polished = mitigateStrictGatewayDefaultSrc(relaxed)
  assert.match(polished, /default-src 'self'/)
  assert.match(polished, /frame-ancestors 'self' file:/)

  const withScript = mitigateStrictGatewayDefaultSrc(
    relaxGatewayFrameAncestors("default-src 'none'; frame-ancestors 'none'; script-src 'self'"),
  )
  assert.match(withScript, /default-src 'none'/)
  assert.match(withScript, /connect-src 'self'/)
  assert.match(withScript, /style-src 'self'/)
}

function testHeaderPatchFallbacks(): void {
  const noCsp = patchGatewayResponseHeaders('http://127.0.0.1:8080', {
    Date: ['now'],
  })
  assert.ok(noCsp)
  assert.equal(noCsp?.['Content-Security-Policy']?.[0], RELAXED_GATEWAY_FRAME_ANCESTORS)

  const emptyCsp = patchGatewayResponseHeaders('https://[::1]:443', {
    'content-security-policy': undefined,
  })
  assert.ok(emptyCsp)
  assert.equal(
    emptyCsp?.['content-security-policy']?.[0] ?? emptyCsp?.['Content-Security-Policy']?.[0],
    RELAXED_GATEWAY_FRAME_ANCESTORS,
  )

  const untouched = patchGatewayResponseHeaders('https://example.com', {
    'X-Frame-Options': ['DENY'],
  })
  assert.equal(untouched, null)
}

function testGatewayRequestTokenRewrite(): void {
  const rewritten = rewriteGatewayRequestUrlWithToken('ws://127.0.0.1:18789/ws?client=desktop', {
    port: 18789,
    token: 'abc123',
  })
  assert.equal(rewritten, 'ws://127.0.0.1:18789/ws?client=desktop&token=abc123')

  const existingToken = rewriteGatewayRequestUrlWithToken('ws://127.0.0.1:18789/ws?token=exists', {
    port: 18789,
    token: 'abc123',
  })
  assert.equal(existingToken, null)

  const wrongPort = rewriteGatewayRequestUrlWithToken('ws://127.0.0.1:19999/ws', {
    port: 18789,
    token: 'abc123',
  })
  assert.equal(wrongPort, null)

  const nonLoopback = rewriteGatewayRequestUrlWithToken('ws://example.com:18789/ws', {
    port: 18789,
    token: 'abc123',
  })
  assert.equal(nonLoopback, null)
}

function main(): void {
  const tests: Array<[name: string, fn: () => void]> = [
    ['loopback url recognition', testLoopbackUrlRecognition],
    ['frame-ancestors relaxation', testFrameAncestorsRelaxation],
    ['mitigate default-src none for embed', testMitigateDefaultSrcNone],
    ['header patch for loopback', testHeaderPatchForLoopbackResponse],
    ['header patch fallbacks', testHeaderPatchFallbacks],
    ['gateway request token rewrite', testGatewayRequestTokenRewrite],
  ]

  for (const [name, fn] of tests) {
    fn()
    process.stdout.write(`[smoke:csp] PASS ${name}\n`)
  }
}

try {
  main()
} catch (error) {
  process.stderr.write(`[smoke:csp] FAIL ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
}
