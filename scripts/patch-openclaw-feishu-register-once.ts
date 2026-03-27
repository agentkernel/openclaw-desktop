/**
 * OpenClaw Feishu channel: `registerFull` re-runs on every inbound dispatch when
 * `api.registrationMode === "full"`, re-registering tools and spamming logs.
 * Guard once per process via globalThis (gateway child is one Node process).
 *
 * Idempotent: safe to run after every download-openclaw / prepare-bundle.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const GUARD_FLAG = '__openclawDesktopFeishuFullRegistered'

export async function patchOpenClawFeishuRegisterOnce(openclawRoot: string): Promise<void> {
  const dist = join(openclawRoot, 'dist')
  let names: string[]
  try {
    names = await readdir(dist)
  } catch {
    return
  }
  const feishuChunks = names.filter((n) => /^feishu-.*\.js$/.test(n))
  for (const name of feishuChunks) {
    const filePath = join(dist, name)
    let raw = await readFile(filePath, 'utf8')
    if (raw.includes(GUARD_FLAG)) continue

    if (!raw.includes('registerFeishuSubagentHooks')) continue
    const re = /(registerFull\(api\)\s*\{)(\s*)(registerFeishuSubagentHooks\(api\);)/
    if (!re.test(raw)) {
      console.warn(`  [patch-feishu] registerFull pattern not found in ${name} — skip (upstream layout changed?)`)
      continue
    }
    raw = raw.replace(re, (_m, p1: string, p2: string, p3: string) => {
      return `${p1}${p2}if(globalThis.${GUARD_FLAG})return;globalThis.${GUARD_FLAG}=!0;${p3}`
    })
    await writeFile(filePath, raw, 'utf8')
    console.log(`  [patch-feishu] ${name}: registerFull guarded (once per process)`)
  }
}
