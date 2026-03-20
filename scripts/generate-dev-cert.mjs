#!/usr/bin/env node
/**
 * Generate a self-signed code-signing .pfx for dev/test (SmartScreen may still warn).
 * Public releases: use a commercial cert or programs like SignPath for OSS.
 */
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const certDir = join(root, 'certs')
const certPath = join(certDir, 'openclaw-dev.pfx')
const password = 'openclaw-dev'

const opensslConf = `[ req ]
default_bits = 2048
default_md = sha256
prompt = no
distinguished_name = dn
x509_extensions = v3_req

[ dn ]
CN = OpenClaw Desktop (Dev)
O = wurongzhao@AgentKernel

[ v3_req ]
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
`

function findOpenSSL() {
  const candidates = [
    'openssl',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  ]
  for (const cmd of candidates) {
    try {
      execSync(`"${cmd}" version`, { stdio: 'ignore' })
      return cmd
    } catch {
      continue
    }
  }
  return null
}

function genWithOpenSSL() {
  const openssl = findOpenSSL()
  if (!openssl) return false

  mkdirSync(certDir, { recursive: true })
  const confPath = join(certDir, 'codesign.cnf')
  writeFileSync(confPath, opensslConf)

  const keyPath = join(certDir, 'key.pem')
  const certPathPem = join(certDir, 'cert.pem')

  execSync(
    `"${openssl}" req -x509 -config "${confPath}" -days 365 -out "${certPathPem}" -keyout "${keyPath}" -newkey rsa:2048 -nodes`,
    { cwd: root, stdio: 'inherit' }
  )
  execSync(
    `"${openssl}" pkcs12 -export -out "${certPath}" -inkey "${keyPath}" -in "${certPathPem}" -passout pass:${password}`,
    { cwd: root, stdio: 'inherit' }
  )

  try {
    unlinkSync(confPath)
    unlinkSync(keyPath)
    unlinkSync(certPathPem)
  } catch {
    /* ignore cleanup errors */
  }

  return true
}

function genWithPowerShell() {
  const ps = `$cert = New-SelfSignedCertificate -CertStoreLocation cert:\\currentuser\\my -Subject "CN=OpenClaw Desktop (Dev)" -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -KeyUsage DigitalSignature -Type CodeSigningCert -NotAfter (Get-Date).AddYears(1)
Export-PfxCertificate -Cert $cert -FilePath "${certPath.replace(/\\/g, '\\\\')}" -Password (ConvertTo-SecureString -String "${password}" -Force -AsPlainText)
Remove-Item -Path "cert:\\currentuser\\my\\$($cert.Thumbprint)" -Force`
  const r = spawnSync('powershell', ['-ExecutionPolicy', 'Bypass', '-Command', ps], {
    cwd: root,
    stdio: 'inherit',
  })
  return r.status === 0
}

async function main() {
  if (existsSync(certPath)) {
    console.log('Certificate already exists:', certPath)
    console.log('Delete the file to regenerate.\n')
    printNextSteps(certPath)
    return
  }

  mkdirSync(certDir, { recursive: true })
  console.log('Generating self-signed code-signing certificate...\n')

  if (genWithOpenSSL()) {
    console.log('\n✓ Generated with OpenSSL')
  } else if (genWithPowerShell()) {
    console.log('\n✓ Generated with PowerShell')
  } else {
    console.error('\nError: OpenSSL not found and PowerShell generation failed.')
    console.error('Install Git for Windows (includes OpenSSL) or check PowerShell permissions.')
    process.exit(1)
  }

  printNextSteps(certPath)
}

function printNextSteps(pfxPath) {
  const absPath = pfxPath.replace(/\\/g, '/')
  console.log('Next steps:')
  console.log('  1. Copy .env.example to .env')
  console.log('  2. Set in .env:')
  console.log(`     CSC_LINK=file:///${absPath}`)
  console.log('     CSC_KEY_PASSWORD=openclaw-dev')
  console.log('  3. Run: pnpm run package:win:signed')
  console.log('')
  console.log('Note: Self-signed certs do not remove SmartScreen warnings; they only exercise the signing path.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
