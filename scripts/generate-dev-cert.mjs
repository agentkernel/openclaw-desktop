#!/usr/bin/env node
/**
 * 生成自签名代码签名证书（.pfx）
 * 仅用于开发/测试：不会消除 SmartScreen 警告，但可验证签名流程
 * 公开分发请使用商业证书或 SignPath Foundation（开源项目）
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
O = OpenClaw Contributors

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
    console.log('证书已存在:', certPath)
    console.log('若要重新生成，请先删除该文件。\n')
    printNextSteps(certPath)
    return
  }

  mkdirSync(certDir, { recursive: true })
  console.log('正在生成自签名代码签名证书...\n')

  if (genWithOpenSSL()) {
    console.log('\n✓ 使用 OpenSSL 生成成功')
  } else if (genWithPowerShell()) {
    console.log('\n✓ 使用 PowerShell 生成成功')
  } else {
    console.error('\n错误: 未找到 OpenSSL，且 PowerShell 生成失败。')
    console.error('请安装 Git for Windows（含 OpenSSL）或检查 PowerShell 权限。')
    process.exit(1)
  }

  printNextSteps(certPath)
}

function printNextSteps(pfxPath) {
  const absPath = pfxPath.replace(/\\/g, '/')
  console.log('下一步：')
  console.log('  1. 复制 .env.example 为 .env')
  console.log('  2. 在 .env 中填入：')
  console.log(`     CSC_LINK=file:///${absPath}`)
  console.log('     CSC_KEY_PASSWORD=openclaw-dev')
  console.log('  3. 运行: pnpm run package:win:signed')
  console.log('')
  console.log('注意: 自签名证书不会消除 SmartScreen 警告，仅用于验证签名流程。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
