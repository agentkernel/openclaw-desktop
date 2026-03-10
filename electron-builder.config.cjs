/**
 * electron-builder 配置（支持条件签名）
 * - 未设置 CSC_LINK 时：不签名，适合本地/内测
 * - 设置 CSC_LINK + CSC_KEY_PASSWORD 时：自动代码签名
 * 使用:
 *   pnpm run package:win         - 构建（有证书则签名）
 *   pnpm run package:win:signed  - 必须签名，否则失败（会加载 .env）
 */
const fs = require('node:fs')
const path = require('node:path')

const hasExplicitCert = Boolean(process.env.CSC_LINK || process.env.WIN_CSC_LINK)
if (!hasExplicitCert && process.env.CSC_IDENTITY_AUTO_DISCOVERY == null) {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
}

function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function readEntryPath(openclawDir) {
  const entryJs = path.join(openclawDir, 'dist', 'entry.js')
  const entryMjs = path.join(openclawDir, 'dist', 'entry.mjs')
  if (exists(entryJs)) return entryJs
  if (exists(entryMjs)) return entryMjs
  return null
}

function validateOpenclaw(openclawDir) {
  const missing = []

  if (!exists(path.join(openclawDir, 'openclaw.mjs'))) {
    missing.push('openclaw.mjs')
  }
  if (!exists(path.join(openclawDir, 'node_modules'))) {
    missing.push('node_modules/')
  }

  const entryPath = readEntryPath(openclawDir)
  if (!entryPath) {
    missing.push('dist/entry.(m)js')
    return missing
  }

  try {
    const entryContent = fs.readFileSync(entryPath, 'utf-8')
    const importRegex = /\bimport\s+(?:[^'"]+from\s+)?['"](\.\/[^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(entryContent))) {
      const rel = match[1]
      if (!rel.startsWith('./')) continue
      const target = path.join(openclawDir, 'dist', rel.replace(/^\.\//, ''))
      if (!exists(target)) {
        missing.push(`dist/${rel.replace(/^\.\//, '')}`)
      }
    }
  } catch {
    missing.push('dist/entry.(m)js (read failed)')
  }

  return missing
}

const iconIcoPath = path.join(__dirname, 'resources', 'icon.ico')
const fastInstallerMode = process.env.OPENCLAW_FAST_INSTALLER !== '0'

module.exports = {
  appId: 'com.openclaw.desktop',
  productName: 'OpenClaw Desktop',
  copyright: 'Copyright © 2026 OpenClaw Contributors',

  publish: {
    provider: 'github',
    vPrefixedTagName: true,
    releaseType: 'release',
  },

  directories: {
    output: 'dist',
    buildResources: 'resources',
  },

  electronDist: 'node_modules/electron/dist',

  asar: true,
  compression: 'normal',
  // 解包 renderer/preload，避免 asar 内 file:// 在 Windows 下导致白屏（相对路径解析失败）
  asarUnpack: ['out/renderer/**', 'out/preload/**'],

  extraResources: [
    { from: 'resources/node', to: 'node', filter: ['**/*'] },
    { from: 'resources/openclaw', to: 'openclaw', filter: ['**/*'] },
    ...(exists(iconIcoPath)
      ? [{ from: iconIcoPath, to: 'icon.ico' }]
      : []),
    ...(exists(path.join(__dirname, 'resources', 'tray-icon.png'))
      ? [{ from: 'resources/tray-icon.png', to: 'tray-icon.png' }]
      : []),
    ...(exists(path.join(__dirname, 'resources', 'apple-touch-icon.png'))
      ? [{ from: 'resources/apple-touch-icon.png', to: 'apple-touch-icon.png' }]
      : []),
    ...(exists(path.join(__dirname, 'resources', 'bundle-manifest.json'))
      ? [{ from: 'resources/bundle-manifest.json', to: 'bundle-manifest.json' }]
      : []),
  ],

  afterPack: async (context) => {
    const appOutDir = context.appOutDir
    const source = path.join(__dirname, 'resources', 'openclaw')
    const target = path.join(appOutDir, 'resources', 'openclaw')

    if (exists(source)) {
      fs.rmSync(target, { recursive: true, force: true })
      fs.mkdirSync(target, { recursive: true })
      fs.cpSync(source, target, { recursive: true, force: true, dereference: true })
    }

    const missing = validateOpenclaw(target)
    if (missing.length > 0) {
      throw new Error(`Packaged OpenClaw resources missing: ${missing.join(', ')}`)
    }
  },

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: iconIcoPath,
    artifactName: 'OpenClaw-Setup-${version}.${ext}',
    // 必须为 true 才能将 icon 嵌入 exe；false 时 electron-builder 会跳过 rcedit 步骤（不下载 winCodeSign），图标不生效
    // 无 CSC_LINK 时仅执行 edit（嵌入图标），不执行签名
    // 设置 SKIP_EXE_RESOURCE_EDIT=1 可跳过（用于 GitHub/镜像均不可达时的本地构建）
    signAndEditExecutable: process.env.SKIP_EXE_RESOURCE_EDIT !== '1',
    // 代码签名：设置 CSC_LINK + CSC_KEY_PASSWORD（或 WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD）时自动签名
    forceCodeSigning: false, // 无证书时仍可构建，适合本地/内测
    // 额外签名 exe/dll（如 node.exe 与相关 DLL），仅在有证书时生效
    signExts: ['exe', 'dll'],
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    // Use zip container for faster extraction on large bundled resources.
    useZip: fastInstallerMode,
    // Differential package is not used in our current release flow.
    differentialPackage: false,
    installerIcon: iconIcoPath,
    uninstallerIcon: iconIcoPath,
    installerSidebar: 'resources/installer/installer-sidebar.bmp',
    license: 'resources/installer/license.txt',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'OpenClaw Desktop',
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
    include: 'build/installer.nsh',
  },

  files: [
    'out/**/*',
    'package.json',
    '!node_modules/**/*',
    '!src/**/*',
    '!scripts/**/*',
    '!build/**/*',
    '!docs/**/*',
    '!.cobrain/**/*',
    '!.github/**/*',
    '!resources/node/**/*',
    '!resources/openclaw/**/*',
  ],
}
