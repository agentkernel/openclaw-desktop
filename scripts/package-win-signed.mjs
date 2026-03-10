#!/usr/bin/env node
/**
 * 带签名的 Windows 打包
 * - 校验 CSC_LINK / WIN_CSC_KEY_PASSWORD 已设置
 * - 自动加载 .env（若存在）
 * - 执行 package:win
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env')

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) {
      const key = m[1]
      const val = m[2].replace(/^["']|["']$/g, '').trim()
      if (val && !process.env[key]) process.env[key] = val
    }
  }
}

const hasCert = process.env.CSC_LINK || process.env.WIN_CSC_LINK
const hasPass = process.env.CSC_KEY_PASSWORD || process.env.WIN_CSC_KEY_PASSWORD

if (!hasCert || !hasPass) {
  console.error('错误: 签名构建需要设置证书环境变量')
  console.error('  设置 CSC_LINK + CSC_KEY_PASSWORD（或 WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD）')
  console.error('  或复制 .env.example 为 .env 并填入后重新运行')
  process.exit(1)
}

console.log('检测到签名证书，开始打包...\n')
const r = spawnSync('pnpm', ['run', 'package:win'], { stdio: 'inherit', cwd: root, env: process.env })
process.exit(r.status ?? 1)
