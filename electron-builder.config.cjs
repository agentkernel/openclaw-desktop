/**
 * electron-builder config (optional code signing).
 * - No CSC_LINK → unsigned (fine for local builds)
 * - CSC_LINK + CSC_KEY_PASSWORD → sign automatically
 * Commands:
 *   pnpm run package:win         — build (signs if cert present)
 *   pnpm run package:win:signed — require signing (loads .env)
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

  const controlUiIndex = path.join(openclawDir, 'dist', 'control-ui', 'index.html')
  if (!exists(controlUiIndex)) {
    missing.push('dist/control-ui/index.html (gateway Control UI)')
  }

  return missing
}

const iconIcoPath = path.join(__dirname, 'resources', 'icon.ico')
const fastInstallerMode = process.env.OPENCLAW_FAST_INSTALLER !== '0'

module.exports = {
  appId: 'com.openclaw.desktop',
  productName: 'OpenClaw Desktop',
  copyright: 'Copyright © 2026 wurongzhao@AgentKernel',

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
  // Unpack renderer/preload so file:// resolves assets on Windows (avoid blank screen)
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
    // true = rcedit embeds icon; false skips rcedit (no winCodeSign fetch) — icon missing
    // Without CSC_LINK only resource edit runs, not signing
    // SKIP_EXE_RESOURCE_EDIT=1 skips edit when mirrors are unreachable
    signAndEditExecutable: process.env.SKIP_EXE_RESOURCE_EDIT !== '1',
    // Signing: CSC_LINK + CSC_KEY_PASSWORD (or WIN_* variants)
    forceCodeSigning: false, // Allow unsigned builds without a cert
    // Also sign bundled exe/dll when a cert is configured
    signExts: ['exe', 'dll'],
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    // 安装程序启动时显示语言选择（向导 UI 多语言）
    displayLanguageSelector: true,
    multiLanguageInstaller: true,
    installerLanguages: ['en_US', 'zh_CN', 'zh_TW'],
    // 许可协议页固定为英文单文件（须为 UTF-8 带 BOM，NSIS 才能正确显示）
    license: 'resources/installer/license.txt',
    // Use zip container for faster extraction on large bundled resources.
    useZip: fastInstallerMode,
    // Differential package is not used in our current release flow.
    differentialPackage: false,
    installerIcon: iconIcoPath,
    uninstallerIcon: iconIcoPath,
    installerSidebar: 'resources/installer/installer-sidebar.bmp',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'OpenClaw Desktop',
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
    // Repo must ship build/installer.nsh (.gitignore exception) — NSIS fails if missing
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
