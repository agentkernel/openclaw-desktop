#!/usr/bin/env node
/**
 * 导出开发者证书的 base64，用于 GitHub Actions Secrets
 * 运行前请先执行 pnpm run generate-dev-cert
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const certPath = join(__dirname, '..', 'certs', 'openclaw-dev.pfx')

if (!existsSync(certPath)) {
  console.error('错误: 未找到证书，请先运行 pnpm run generate-dev-cert')
  process.exit(1)
}

const pfx = readFileSync(certPath)
const base64 = pfx.toString('base64').replace(/\n/g, '')

console.log('# 复制以下 base64 作为 GitHub Secret CSC_LINK 的值（完整复制，无换行/空格）:\n')
console.log(base64)
if (base64.length > 8192) {
  console.log('\n# 警告: base64 超 8192 字符，Windows 环境变量可能截断，建议导出证书时去掉链证书')
}
console.log('\n# CSC_KEY_PASSWORD 的值:')
console.log('openclaw-dev')
console.log('\n# 在仓库 Settings → Secrets → Actions 中添加上述两个 Secret 后，Release 流程将使用开发者签名。')
